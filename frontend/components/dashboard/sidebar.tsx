'use client';
import { cn } from '@/lib/utils';
import type { ExtractionJob } from '@/types';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  FileOutput,
  FileScan,
  FileText,
  Layers2,
  Leaf,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

export type GuideType = 'how' | 'export' | 'privacy' | 'sample' | null;
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <FileScan size={23} strokeWidth={1.7} />
      </span>
      <span>
        PDF Contact
        <span className="brand-second">
          Extractor<span className="brand-period">.</span>
        </span>
      </span>
    </div>
  );
}
export function Sidebar({
  onGuide,
  onReset,
  job,
  busy,
  mobileOpen,
  onClose,
}: {
  onGuide: (guide: GuideType) => void;
  onReset: () => void;
  job: ExtractionJob | null;
  busy: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = [
          ...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []),
        ];
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [mobileOpen, onClose]);
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside
        ref={sidebarRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        className={cn('sidebar', mobileOpen && 'sidebar-open')}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <Brand />
          <button className="mobile-close icon-button" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">
            <Layers2 size={16} />
          </div>
          <div>
            <strong>Personal workspace</strong>
            <span>No account needed</span>
          </div>
          <span className="workspace-free">FREE</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-links">
          <a href="#upload" className="nav-link active" onClick={onClose}>
            <FileScan size={18} />
            <span>Extract contacts</span>
            <span className="active-dot" />
          </a>
          <button
            className="nav-link"
            onClick={() => {
              onGuide('how');
              onClose();
            }}
          >
            <BookOpen size={18} />
            <span>How it works</span>
            <ChevronRight size={14} />
          </button>
          <button
            className="nav-link"
            onClick={() => {
              onGuide('export');
              onClose();
            }}
          >
            <FileOutput size={18} />
            <span>Export guide</span>
            <ArrowUpRight size={14} />
          </button>
        </nav>
        <div className="session-section">
          <div className="nav-label">
            THIS SESSION <span className="session-count">{job ? '1' : '0'}</span>
          </div>
          {job ? (
            <a className="session-item" href="#results" onClick={onClose}>
              <span className={cn('session-icon', busy && 'is-processing')}>
                <FileText size={17} />
              </span>
              <span>
                <strong>
                  {job.files.length > 1 ? `${job.files.length} PDF documents` : job.files[0]?.name}
                </strong>
                <small>
                  {busy
                    ? 'Processing documents…'
                    : job.status === 'complete'
                      ? `${job.stats?.total || 0} contacts extracted`
                      : job.status === 'cancelled'
                        ? 'Extraction cancelled'
                        : 'Needs your attention'}
                </small>
              </span>
            </a>
          ) : (
            <div className="session-empty">
              <span className="session-empty-icon">
                <FileText size={16} />
              </span>
              <span>
                Your extractions will
                <br />
                appear here.
              </span>
            </div>
          )}
          {job && (
            <button className="new-session-link" onClick={onReset} disabled={busy}>
              <Plus size={14} /> New extraction
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={20} strokeWidth={1.7} />
            </span>
            <h3>Your files. Just yours.</h3>
            <p>PDFs are automatically deleted after processing. Your data stays in your control.</p>
            <button onClick={() => onGuide('privacy')}>
              Our privacy promise <ArrowUpRight size={13} />
            </button>
            <Leaf className="privacy-leaf" size={87} strokeWidth={0.7} />
          </div>
          <button className="sidebar-help" onClick={() => onGuide('how')}>
            <CircleHelp size={17} />
            <span>A little help?</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-version">
            <span className="version-dot" /> Simple by design <span>v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
