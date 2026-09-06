import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { initializeUploads } from '../src/middleware/upload.js';
import { config } from '../src/config.js';
import * as XLSX from 'xlsx';

const { app, jobs } = createApp();
const fixture = (name: string) => path.resolve('backend/tests/fixtures', name);
beforeAll(initializeUploads);
afterAll(async () => {
  await jobs.dispose();
  await rm(config.uploadDir, { recursive: true, force: true });
});
async function completedJob(id: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await request(app).get(`/api/jobs/${id}`).expect(200);
    if (['complete', 'failed', 'cancelled'].includes(response.body.job.status)) return response.body.job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Job did not finish within 20 seconds');
}
async function temporaryPdfs() {
  return (await readdir(config.uploadDir)).filter((f) => f.endsWith('.pdf'));
}

describe('real REST API', () => {
  it('reports health and configured upload limits', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({
      success: true,
      status: 'ok',
      limits: { maxFileSize: 26214400, maxFiles: 10 },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('uploads multiple PDFs, executes workers, returns contacts and removes temporary files', async () => {
    const response = await request(app)
      .post('/api/extract')
      .attach('files', fixture('text-contacts.pdf'))
      .attach('files', fixture('scanned-contacts.pdf'))
      .expect(202);
    const id = response.body.jobId;
    expect(id).toMatch(/^[\w-]{32}$/);
    const job = await completedJob(id);
    expect(job.status).toBe('complete');
    expect(job.contacts).toHaveLength(13);
    expect(job.stats).toMatchObject({ total: 13, filesProcessed: 2, duplicates: 5, invalid: 1 });
    expect(job.files[1]).toMatchObject({ usedOcr: true, stage: 'complete', contacts: 4 });
    expect(JSON.stringify(job)).not.toContain(config.uploadDir);
    expect(await temporaryPdfs()).toHaveLength(0);
    await request(app).delete(`/api/jobs/${id}`).expect(204);
    await request(app).get(`/api/jobs/${id}`).expect(404);
  });
  it('handles invalid content as a per-file error, while processing other files', async () => {
    const response = await request(app)
      .post('/api/extract')
      .attach('files', Buffer.from('not a PDF'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .attach('files', fixture('text-contacts.pdf'))
      .expect(202);
    const job = await completedJob(response.body.jobId);
    expect(job.status).toBe('complete');
    expect(job.contacts).toHaveLength(9);
    expect(job.files[0].error).toContain('not a valid PDF');
    expect(job.files[0].stage).toBe('error');
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('fails a corrupted PDF with a safe message and deletes it', async () => {
    const response = await request(app)
      .post('/api/extract')
      .attach('files', Buffer.from('%PDF-1.7\ncorrupted bytes'), {
        filename: 'corrupted.pdf',
        contentType: 'application/pdf',
      })
      .expect(202);
    const job = await completedJob(response.body.jobId);
    expect(job.status).toBe('failed');
    expect(job.files[0].error).toMatch(/corrupted|invalid/i);
    expect(job.files[0].error).not.toContain('at ');
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('cancels workers and deletes their PDFs', async () => {
    const response = await request(app)
      .post('/api/extract')
      .attach('files', fixture('scanned-contacts.pdf'))
      .expect(202);
    const cancelled = await request(app).post(`/api/jobs/${response.body.jobId}/cancel`).expect(200);
    expect(cancelled.body.job.status).toBe('cancelled');
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('awaits the same cleanup for concurrent cancellation requests', async () => {
    const upload = await request(app)
      .post('/api/extract')
      .attach('files', fixture('scanned-contacts.pdf'))
      .expect(202);
    const url = `/api/jobs/${upload.body.jobId}/cancel`;
    const responses = await Promise.all([
      request(app).post(url).expect(200),
      request(app).post(url).expect(200),
    ]);
    for (const response of responses) expect(response.body.job.status).toBe('cancelled');
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('does not return a result past its configured expiration', async () => {
    const upload = await request(app)
      .post('/api/extract')
      .attach('files', fixture('text-contacts.pdf'))
      .expect(202);
    await completedJob(upload.body.jobId);
    const original = config.jobTtlMs;
    config.jobTtlMs = 1;
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await request(app).get(`/api/jobs/${upload.body.jobId}`).expect(404);
    } finally {
      config.jobTtlMs = original;
    }
  });
  it('rejects unsupported uploads and empty requests', async () => {
    const invalid = await request(app)
      .post('/api/extract')
      .attach('files', Buffer.from('hello'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(415);
    expect(invalid.body.error.message).toContain('Only PDF');
    await request(app).post('/api/extract').expect(400);
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('enforces the per-file size cap and cleans partial uploads', async () => {
    const bytes = Buffer.alloc(config.maxFileSize + 1024);
    bytes.write('%PDF-1.7');
    const result = await request(app)
      .post('/api/extract')
      .attach('files', bytes, { filename: 'large.pdf', contentType: 'application/pdf' })
      .expect(413);
    expect(result.body.error.message).toContain('25 MB');
    expect(await temporaryPdfs()).toHaveLength(0);
  });
  it('cleans an upload when the client disconnects midway', async () => {
    const server = app.listen(0, '0.0.0.0');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    const client = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/extract',
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=abort-test-boundary' },
    });
    client.on('error', () => {});
    try {
      client.write(
        '--abort-test-boundary\r\nContent-Disposition: form-data; name="files"; filename="interrupted.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n',
      );
      client.write(Buffer.alloc(128 * 1024));
      for (let i = 0; i < 30 && !(await temporaryPdfs()).length; i++)
        await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await temporaryPdfs()).toHaveLength(1);
      client.destroy();
      for (let i = 0; i < 50 && (await temporaryPdfs()).length; i++)
        await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await temporaryPdfs()).toHaveLength(0);
    } finally {
      client.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('terminates timed-out jobs and removes their uploads', async () => {
    const original = config.jobTimeoutMs;
    config.jobTimeoutMs = 5;
    try {
      const response = await request(app)
        .post('/api/extract')
        .attach('files', fixture('scanned-contacts.pdf'))
        .expect(202);
      const job = await completedJob(response.body.jobId);
      expect(job.status).toBe('failed');
      expect(job.error).toContain('timed out');
      expect(await temporaryPdfs()).toHaveLength(0);
    } finally {
      config.jobTimeoutMs = original;
    }
  });
  it('validates job IDs and handles unknown jobs', async () => {
    await request(app).get('/api/jobs/not-valid').expect(400);
    await request(app).get('/api/jobs/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx').expect(404);
    await request(app).get('/api/unknown').expect(404);
  });
  it('exports CSV from edited values and serves a professional filename', async () => {
    const result = await request(app)
      .post('/api/export')
      .send({
        format: 'csv',
        contacts: [{ name: 'Edited Name', phone: '03001234567', sourceFile: 'test.pdf' }],
      })
      .expect(200);
    expect(result.headers['content-disposition']).toMatch(/extracted-contacts-\d{4}-\d{2}-\d{2}\.csv/);
    expect(result.text).toContain('"Edited Name","\'03001234567","test.pdf"');
  });
  it('exports a real XLSX workbook with text cells', async () => {
    const result = await request(app)
      .post('/api/export')
      .send({
        format: 'xlsx',
        contacts: [{ name: 'Edited Name', phone: '03001234567', sourceFile: 'test.pdf' }],
      })
      .expect(200)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(result.headers['content-type']).toContain('spreadsheetml');
    const sheet = XLSX.read(result.body, { type: 'buffer' }).Sheets.Contacts;
    expect(sheet.B2).toMatchObject({ t: 's', v: '03001234567' });
    expect(sheet.A2.v).toBe('Edited Name');
  });
  it('validates export input and malformed JSON', async () => {
    await request(app).post('/api/export').send({ format: 'exe', contacts: [] }).expect(400);
    await request(app)
      .post('/api/export')
      .set('Content-Type', 'application/json')
      .send('{ bad json')
      .expect(400);
    await request(app)
      .post('/api/export')
      .send({
        format: 'csv',
        contacts: [{ name: 'x'.repeat(200), phone: '03001234567', sourceFile: 'a.pdf' }],
      })
      .expect(400);
  });
  it('allows configured origins but blocks untrusted browser origins', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:3000').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    await request(app).post('/api/export').set('Origin', 'https://untrusted.example').send({}).expect(403);
  });
  it('keeps the temporary upload directory private', async () =>
    expect((await stat(config.uploadDir)).mode & 0o777).toBe(0o700));
  it('rate-limits upload attempts', async () => {
    const limited = createApp();
    try {
      for (let i = 0; i < 20; i++) await request(limited.app).post('/api/extract').expect(400);
      const response = await request(limited.app).post('/api/extract').expect(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');
    } finally {
      await limited.jobs.dispose();
    }
  });
});
