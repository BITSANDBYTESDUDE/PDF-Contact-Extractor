import type { Contact, ExtractionJob, UploadLimits } from '@/types';
export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
export const DEFAULT_LIMITS: UploadLimits = {
  maxFileSize: 25 * 1024 * 1024,
  maxTotalSize: 100 * 1024 * 1024,
  maxFiles: 10,
  maxPages: 100,
};
async function errorMessage(response: Response) {
  try {
    const data = await response.json();
    return data.error?.message || 'The request could not be completed. Please try again.';
  } catch {
    return response.status === 413
      ? 'The upload is too large. Try fewer or smaller PDFs.'
      : 'The server is temporarily unavailable. Please try again shortly.';
  }
}
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, { ...init, cache: 'no-store' });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void,
  onXhr: (xhr: XMLHttpRequest) => void,
): Promise<ExtractionJob> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    files.forEach((file) => data.append('files', file));
    const xhr = new XMLHttpRequest();
    onXhr(xhr);
    xhr.open('POST', `${API_BASE}/api/extract`);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.job) resolve(response.job);
        else
          reject(new Error(response.error?.message || 'The upload could not be accepted. Please try again.'));
      } catch {
        reject(new Error('The server is temporarily unavailable. Please try again shortly.'));
      }
    };
    xhr.onerror = () => reject(new Error('Connection lost. Check your internet connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Try fewer or smaller PDF files.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    xhr.send(data);
  });
}
export async function downloadContacts(contacts: Contact[], format: 'xlsx' | 'csv', preserveForExcel = true) {
  const response = await fetch(`${API_BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format,
      preserveForExcel,
      contacts: contacts.map(({ name, phone, sourceFile }) => ({ name, phone, sourceFile })),
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ||
    `extracted-contacts-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
