'use client';
import { API_BASE, apiJson, DEFAULT_LIMITS, uploadFiles } from '@/lib/api';
import { formatBytes, plural } from '@/lib/utils';
import type { Contact, ExtractionJob, SelectedFile, UploadLimits } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function useExtractor() {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [job, setJob] = useState<ExtractionJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<UploadLimits>(DEFAULT_LIMITS);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const abort = new AbortController();
    apiJson<{ limits: UploadLimits }>('/health', { signal: abort.signal })
      .then((data) => setLimits(data.limits))
      .catch(() => {});
    return () => {
      abort.abort();
      xhrRef.current?.abort();
      abortRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (busy || contacts.length) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy, contacts.length]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (busy) return;
      const next = [...files];
      const errors: string[] = [];
      let added = 0;
      for (const file of incoming) {
        if (
          !file.name.toLowerCase().endsWith('.pdf') ||
          (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type))
        ) {
          errors.push(`${file.name}: only PDF files are supported.`);
          continue;
        }
        if (!file.size) {
          errors.push(`${file.name} is empty. Choose a PDF with content.`);
          continue;
        }
        if (file.size > limits.maxFileSize) {
          errors.push(`${file.name} exceeds the ${formatBytes(limits.maxFileSize)} limit.`);
          continue;
        }
        if (next.length >= limits.maxFiles) {
          errors.push(`You can upload up to ${limits.maxFiles} PDFs at a time.`);
          break;
        }
        if (
          next.some(
            (f) =>
              f.file.name === file.name &&
              f.file.size === file.size &&
              f.file.lastModified === file.lastModified,
          )
        ) {
          errors.push(`${file.name} is already selected.`);
          continue;
        }
        if (next.reduce((sum, f) => sum + f.file.size, 0) + file.size > limits.maxTotalSize) {
          errors.push(`Keep the total upload below ${formatBytes(limits.maxTotalSize)}.`);
          continue;
        }
        next.push({ id: crypto.randomUUID(), file });
        added++;
      }
      setFiles(next);
      setError(errors.length ? [...new Set(errors)].join(' ') : null);
      if (added) toast.success(`${plural(added, 'PDF')} ready to extract`);
    },
    [files, busy, limits],
  );

  const extract = useCallback(async () => {
    if (!files.length || runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setError(null);
    setUploadProgress(0);
    setJob(null);
    setContacts([]);
    setDuplicatesRemoved(0);
    const controller = new AbortController();
    abortRef.current = controller;
    let newId: string | null = null;
    try {
      // The user has confirmed replacing any previous edits before starting a new batch.
      if (jobIdRef.current)
        void fetch(`${API_BASE}/api/jobs/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
      jobIdRef.current = null;
      let current = await uploadFiles(
        files.map((f) => f.file),
        setUploadProgress,
        (xhr) => {
          xhrRef.current = xhr;
        },
      );
      newId = current.id;
      jobIdRef.current = current.id;
      setFiles((previous) =>
        previous.map((file, index) => ({ ...file, id: current.files[index]?.id || file.id })),
      );
      setJob(current);
      let failures = 0;
      while (!['complete', 'failed', 'cancelled'].includes(current.status)) {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Cancelled', 'AbortError'));
          };
          const timer = setTimeout(
            () => {
              controller.signal.removeEventListener('abort', onAbort);
              resolve();
            },
            failures ? 2000 : 850,
          );
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        try {
          const response = await apiJson<{ job: ExtractionJob }>(`/jobs/${current.id}`, {
            signal: controller.signal,
          });
          current = response.job;
          failures = 0;
          setJob(current);
        } catch (e) {
          if (controller.signal.aborted || ++failures > 4) throw e;
        }
      }
      if (current.status === 'complete') {
        setContacts(current.contacts || []);
        setDuplicatesRemoved(0);
        if (current.contacts?.length)
          toast.success(`Extraction complete. ${plural(current.contacts.length, 'contact')} found.`);
        else toast.info('No contacts found. Check the file details for suggestions.');
      } else if (current.status === 'failed') {
        setError(current.error || 'Extraction failed. Please try again.');
        toast.error('Some documents could not be read. Check the file details.');
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        const message = e.message || 'Extraction failed. Please try again.';
        setError(message);
        toast.error(message);
      }
      if (newId) void fetch(`${API_BASE}/api/jobs/${newId}/cancel`, { method: 'POST' }).catch(() => {});
    } finally {
      setBusy(false);
      runningRef.current = false;
      xhrRef.current = null;
    }
  }, [files]);

  const cancel = useCallback(async () => {
    xhrRef.current?.abort();
    abortRef.current?.abort();
    if (jobIdRef.current) {
      try {
        const response = await apiJson<{ job: ExtractionJob }>(`/jobs/${jobIdRef.current}/cancel`, {
          method: 'POST',
        });
        setJob(response.job);
      } catch {
        /* Server timeout and cleanup remain active when the connection is unavailable. */
      }
    }
    toast.info('Extraction cancelled. Temporary uploads are being cleaned up.');
  }, []);
  const reset = useCallback(() => {
    if (busy) return;
    if (jobIdRef.current)
      void fetch(`${API_BASE}/api/jobs/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
    jobIdRef.current = null;
    setFiles([]);
    setContacts([]);
    setJob(null);
    setError(null);
    setDuplicatesRemoved(0);
    setUploadProgress(0);
  }, [busy]);
  return {
    files,
    contacts,
    setContacts,
    job,
    busy,
    uploadProgress,
    error,
    setError,
    limits,
    duplicatesRemoved,
    setDuplicatesRemoved,
    addFiles,
    extract,
    cancel,
    reset,
    removeFile: (id: string) => {
      if (!busy) setFiles((prev) => prev.filter((f) => f.id !== id));
    },
    clearFiles: () => {
      if (!busy) {
        setFiles([]);
        setError(null);
      }
    },
  };
}
