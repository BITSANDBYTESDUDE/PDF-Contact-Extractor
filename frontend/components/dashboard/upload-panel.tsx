'use client';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, formatBytes, plural } from '@/lib/utils';
import type { ExtractionJob, SelectedFile, UploadLimits } from '@/types';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  CircleCheck,
  FileText,
  Info,
  Loader2,
  LockKeyhole,
  Plus,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
const stages: Record<string, string> = {
  queued: 'Waiting in queue',
  analyzing: 'Analyzing PDF',
  extracting: 'Extracting text',
  ocr: 'Running OCR',
  phones: 'Finding phone numbers',
  names: 'Matching names',
  cleaning: 'Cleaning & checking duplicates',
  complete: 'Complete',
  error: 'Could not process',
};
export function UploadPanel({
  files,
  addFiles,
  removeFile,
  clearFiles,
  extract,
  cancel,
  busy,
  job,
  uploadProgress,
  error,
  onClearError,
  limits,
  onPreview,
  onHow,
}: {
  files: SelectedFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  extract: () => void;
  cancel: () => void;
  busy: boolean;
  job: ExtractionJob | null;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  limits: UploadLimits;
  onPreview: () => void;
  onHow: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const preview =
    job?.status === 'complete' &&
    files.length === job.files.length &&
    files.every((file) => job.files.some((f) => f.id === file.id));
  const progress = !job
    ? uploadProgress * 0.15
    : 15 + (job.files.reduce((sum, f) => sum + f.progress, 0) / Math.max(job.files.length, 1)) * 0.85;
  const activeFile = job?.files.find((file) => !['complete', 'error', 'queued'].includes(file.stage));
  return (
    <section className="upload-card" id="upload" aria-labelledby="upload-title">
      <div className="card-heading">
        <div className="card-title-group">
          <span className="section-icon">
            <Upload size={17} />
          </span>
          <h2 id="upload-title">Upload documents</h2>
        </div>
        <span className="card-meta">Up to {limits.maxFiles} PDFs at once</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        aria-label="Choose PDF files"
        disabled={busy}
        onChange={(event) => {
          addFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      <div
        onClick={(event) => {
          if (!busy && !(event.target as HTMLElement).closest('button')) input.current?.click();
        }}
        className={cn(
          'dropzone',
          dragging && 'dropzone-active',
          files.length > 0 && 'dropzone-compact',
          busy && 'dropzone-disabled',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) {
            dragDepth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current--;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (!busy) addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="upload-illustration" aria-hidden="true">
          <span className="upload-orbit" />
          <div className="paper-back" />
          <div className="paper-front">
            <FileText size={31} strokeWidth={1.25} />
            <span>PDF</span>
          </div>
          <span className="upload-bubble">
            <Plus size={16} strokeWidth={2.4} />
          </span>
        </div>
        <div className="dropzone-copy">
          <h3>
            {dragging
              ? 'Right here. Drop to upload.'
              : files.length
                ? 'Room for a few more?'
                : 'Drop your PDFs here'}
          </h3>
          <p>
            {files.length
              ? 'Add another PDF, or start extracting below.'
              : 'Turn a stack of documents into a list of possibilities.'}
          </p>
        </div>
        <Button
          variant="outline"
          className="browse-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Plus size={16} />
          {files.length ? 'Add files' : 'Browse files'}
        </Button>
        {!files.length && (
          <div className="dropzone-formats">
            <span>PDF only</span>
            <i />
            {Math.floor(limits.maxFileSize / 1024 / 1024)} MB per file
            <i />
            Text & scanned PDFs
          </div>
        )}
      </div>
      {files.length > 0 && (
        <div className="selected-files">
          <div className="files-heading">
            <span>
              {plural(files.length, 'file')} selected{' '}
              <span>· {formatBytes(files.reduce((sum, f) => sum + f.file.size, 0))}</span>
            </span>
            <button disabled={busy} onClick={clearFiles}>
              Clear all
            </button>
          </div>
          <div className="file-list">
            {files.map(({ id, file }) => {
              const state = job?.files.find((f) => f.id === id);
              return (
                <div className={cn('file-row', state?.stage === 'error' && 'file-row-error')} key={id}>
                  <span className="file-type-icon">
                    <FileText size={20} strokeWidth={1.5} />
                    <small>PDF</small>
                  </span>
                  <div className="file-info">
                    <strong title={file.name}>{file.name}</strong>
                    <span>
                      {formatBytes(file.size)}
                      {state && (
                        <>
                          {' '}
                          <i>·</i>{' '}
                          {state.stage === 'complete'
                            ? `${state.contacts || 0} contacts${state.usedOcr ? ' · OCR' : ''}`
                            : stages[state.stage]}
                          {state.currentPage && state.stage !== 'complete' && state.stage !== 'error'
                            ? ` · Page ${state.currentPage}/${state.pages}`
                            : ''}
                        </>
                      )}
                    </span>
                    {busy && (
                      <div
                        className="file-progress"
                        role="progressbar"
                        aria-label={`Processing ${file.name}`}
                        aria-valuenow={Math.round(job ? (state?.progress ?? 0) : uploadProgress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${job ? (state?.progress ?? 0) : uploadProgress}%` }} />
                      </div>
                    )}
                    {state?.error && <p className="file-error">{state.error}</p>}
                    {state?.warnings?.map((warning) => (
                      <p className="file-warning" key={warning}>
                        <Info size={12} />
                        {warning}
                      </p>
                    ))}
                  </div>
                  {busy ? (
                    <Loader2 className="spin file-action" size={17} />
                  ) : (
                    <>
                      {state?.stage === 'complete' && <CircleCheck className="file-complete" size={17} />}
                      <button
                        className="icon-button file-action"
                        onClick={() => removeFile(id)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {error && (
        <div className="error-alert" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={onClearError} aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}
      <div className="upload-bottom">
        <span className="upload-security">
          <LockKeyhole size={13} />
          Private files. Temporary storage.
        </span>
        {busy ? (
          <Button variant="outline" size="sm" onClick={cancel}>
            <X size={14} />
            Cancel
          </Button>
        ) : (
          <Tooltip
            content={
              files.length
                ? 'Extract names and numbers from your selected PDFs'
                : 'Choose at least one PDF to get started'
            }
          >
            <span>
              <Button
                className="extract-button"
                disabled={!files.length}
                onClick={preview ? onPreview : extract}
              >
                {preview ? (
                  <>
                    <CheckCheck size={17} />
                    Preview contacts
                    <ArrowDown size={15} />
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Extract contacts
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
      {busy && (
        <div className="overall-progress" role="status" aria-live="polite">
          <div>
            <span>
              <Loader2 size={14} className="spin" />
              {!job
                ? 'Uploading PDF files…'
                : activeFile
                  ? `${stages[activeFile.stage]}…`
                  : job.status === 'queued'
                    ? 'Your files are in the queue…'
                    : 'Finishing your extraction…'}
            </span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="overall-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>
            {activeFile?.stage === 'ocr'
              ? 'Scanned pages take a little longer. You can leave this tab open while we read them.'
              : 'We’re doing the busywork. Your contacts will be ready to review shortly.'}
          </p>
        </div>
      )}
      <div className="upload-footnote">
        <ScanLine size={14} />
        <span>Scanned document? OCR is automatically included.</span>
        <button aria-label="Learn about OCR" onClick={onHow}>
          <Info size={14} />
        </button>
      </div>
    </section>
  );
}

export function WorkflowCard({ onHow }: { onHow: () => void }) {
  return (
    <aside className="workflow-card">
      <div className="workflow-illustration" aria-hidden="true">
        <div className="illustration-grid" />
        <div className="mini-document">
          <div className="mini-document-top">
            <FileText size={17} />
            <span>.pdf</span>
          </div>
          <div className="mini-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="mini-lines second">
            <i />
            <i />
          </div>
          <span className="mini-doc-corner" />
        </div>
        <div className="connecting-line" />
        <span className="conversion-arrow">
          <ArrowRight size={16} />
        </span>
        <div className="mini-contacts">
          <div className="mini-contacts-heading">
            <span />
            CONTACTS
            <span className="mini-check">
              <Check size={9} />
            </span>
          </div>
          <div className="mini-person">
            <b>MA</b>
            <span>
              <i />
              <i />
            </span>
            <Check size={10} />
          </div>
          <div className="mini-person">
            <b>AK</b>
            <span>
              <i />
              <i />
            </span>
            <Check size={10} />
          </div>
          <div className="mini-person">
            <b>SF</b>
            <span>
              <i />
              <i />
            </span>
            <Check size={10} />
          </div>
        </div>
        <span className="illustration-sparkle sparkle-one">✦</span>
        <span className="illustration-sparkle sparkle-two">✧</span>
      </div>
      <div className="workflow-content">
        <span className="eyebrow small">LESS BUSYWORK. MORE POSSIBILITY.</span>
        <h3>
          Goodbye, copy-paste.
          <br /> Hello, clean contacts.
        </h3>
        <div className="workflow-features">
          <span>
            <Check size={14} />
            Names and numbers, neatly paired
          </span>
          <span>
            <Check size={14} />
            Duplicates spotted, not swept away
          </span>
          <span>
            <Check size={14} />
            Excel and CSV, ready when you are
          </span>
        </div>
        <button onClick={onHow}>
          See how it works <ArrowUpRightIcon />
        </button>
      </div>
    </aside>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 12 12 4M4 4h8v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
