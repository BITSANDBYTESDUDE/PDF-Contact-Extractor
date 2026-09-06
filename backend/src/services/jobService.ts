import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { config } from '../config.js';
import type { PublicJob, UploadedFile, WorkerMessage } from '../types.js';
import { AppError } from '../utils/errors.js';

interface InternalJob {
  public: PublicJob;
  uploads: UploadedFile[];
  worker?: Worker;
  timer?: NodeJS.Timeout;
  expiryTimer?: NodeJS.Timeout;
  finalization?: Promise<void>;
  settled: boolean;
}
export class JobService {
  private jobs = new Map<string, InternalJob>();
  private queue: string[] = [];
  private active = 0;
  private closing = false;
  private sweeper = setInterval(() => this.sweep(), 60000).unref();

  assertCapacity() {
    if (this.closing || this.queue.length >= config.maxQueued || this.jobs.size >= 40) {
      throw new AppError(
        503,
        'The processing queue is full. Please try again in a few minutes.',
        'QUEUE_FULL',
      );
    }
  }
  create(uploads: UploadedFile[]): PublicJob {
    this.sweep();
    this.assertCapacity();
    const id = randomBytes(24).toString('base64url');
    const job: InternalJob = {
      public: {
        id,
        status: 'queued',
        createdAt: new Date().toISOString(),
        files: uploads.map((f) => ({ id: f.id, name: f.name, size: f.size, stage: 'queued', progress: 0 })),
      },
      uploads,
      settled: false,
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    this.drain();
    return structuredClone(job.public);
  }
  get(id: string): PublicJob {
    const job = this.jobs.get(id);
    if (job?.public.completedAt && Date.now() - Date.parse(job.public.completedAt) >= config.jobTtlMs) {
      clearTimeout(job.expiryTimer);
      this.jobs.delete(id);
    }
    if (!job || !this.jobs.has(id))
      throw new AppError(
        404,
        'This extraction has expired or could not be found. Please upload the PDFs again.',
        'JOB_NOT_FOUND',
      );
    return structuredClone(job.public);
  }
  async cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new AppError(404, 'This extraction has already expired.', 'JOB_NOT_FOUND');
    await this.finish(job, 'cancelled', 'Extraction cancelled. Your uploaded files have been deleted.');
    return this.get(id);
  }
  /** Explicitly forget a finished batch when a user resets the workspace. */
  async forget(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      await this.finish(job, 'cancelled');
      clearTimeout(job.expiryTimer);
      this.jobs.delete(id);
    }
  }
  private drain() {
    while (!this.closing && this.active < config.concurrency && this.queue.length) {
      const id = this.queue.shift()!;
      const job = this.jobs.get(id);
      if (!job || job.settled) continue;
      this.active++;
      job.public.status = 'processing';
      const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
      try {
        const worker = new Worker(new URL('../workers/bootstrap.mjs', import.meta.url), {
          workerData: {
            module: new URL(`../workers/extractionWorker${extension}`, import.meta.url).href,
            files: job.uploads,
            options: config.processing,
          },
          resourceLimits: { maxOldGenerationSizeMb: 512 },
        });
        job.worker = worker;
        job.timer = setTimeout(() => {
          void this.finish(
            job,
            'failed',
            'Processing timed out. Split this PDF into smaller files or use a clearer scan, then try again.',
          );
        }, config.jobTimeoutMs).unref();
        worker.on('message', (message: WorkerMessage) => {
          if (job.settled) return;
          if (message.type === 'progress') {
            const file = job.public.files.find((f) => f.id === message.fileId);
            if (file)
              Object.assign(file, message.update, {
                progress: Math.max(file.progress, message.update.progress || 0),
              });
          } else if (message.type === 'result') {
            job.public.contacts = message.contacts;
            job.public.stats = message.stats;
            const failed = job.public.files.every((f) => f.stage === 'error');
            void this.finish(
              job,
              failed ? 'failed' : 'complete',
              failed ? 'None of the PDFs could be processed. See the file details below.' : undefined,
            );
          } else void this.finish(job, 'failed', message.error);
        });
        worker.on('error', (error) => {
          console.error(`[job:${id}]`, error);
          void this.finish(
            job,
            'failed',
            'The processing worker stopped unexpectedly. Try fewer or smaller PDF files.',
          );
        });
        worker.on('exit', (code) => {
          if (!job.settled) {
            console.error(`[job:${id}] Worker exited before returning results, code ${code}`);
            void this.finish(job, 'failed', 'Processing was interrupted. Please upload your files again.');
          }
        });
      } catch (error) {
        console.error('[worker-start]', error);
        // Preserve active accounting even when the worker constructor fails.
        this.active--;
        void this.finish(job, 'failed', 'A processing worker could not start. Please try again shortly.');
      }
    }
  }
  private finish(job: InternalJob, status: PublicJob['status'], error?: string): Promise<void> {
    if (job.finalization) return job.finalization;
    if (job.settled) return Promise.resolve();
    job.settled = true;
    job.finalization = this.finalize(job, status, error);
    return job.finalization;
  }
  private async finalize(job: InternalJob, status: PublicJob['status'], error?: string) {
    clearTimeout(job.timer);
    this.queue = this.queue.filter((id) => id !== job.public.id);
    if (job.worker) {
      try {
        await job.worker.terminate();
      } catch {
        /* Already stopped. */
      }
      job.worker = undefined;
      this.active--;
    }
    await Promise.all(
      job.uploads.map((f) => rm(f.path, { force: true }).catch((e) => console.error('[cleanup]', e))),
    );
    job.uploads = [];
    job.public.status = status;
    job.public.completedAt = new Date().toISOString();
    const completedId = job.public.id;
    job.expiryTimer = setTimeout(() => this.jobs.delete(completedId), config.jobTtlMs).unref();
    if (error) job.public.error = error;
    if (status === 'failed' || status === 'cancelled')
      for (const file of job.public.files) {
        if (file.stage !== 'complete' && file.stage !== 'error')
          Object.assign(file, { stage: 'error', progress: 100, error: error || 'Extraction cancelled.' });
      }
    this.drain();
  }
  private sweep() {
    const cutoff = Date.now() - config.jobTtlMs;
    for (const [id, job] of this.jobs) {
      if (job.settled && job.public.completedAt && Date.parse(job.public.completedAt) < cutoff) {
        clearTimeout(job.expiryTimer);
        this.jobs.delete(id);
      }
    }
    // Bound in-memory retained results even under many short successful jobs.
    if (this.jobs.size >= 30)
      for (const [id, job] of this.jobs) {
        if (job.settled && job.public.completedAt) {
          clearTimeout(job.expiryTimer);
          this.jobs.delete(id);
        }
        if (this.jobs.size < 25) break;
      }
  }
  async dispose() {
    this.closing = true;
    clearInterval(this.sweeper);
    await Promise.all([...this.jobs.values()].map((j) => this.finish(j, 'cancelled')));
    for (const job of this.jobs.values()) clearTimeout(job.expiryTimer);
    this.jobs.clear();
  }
}
