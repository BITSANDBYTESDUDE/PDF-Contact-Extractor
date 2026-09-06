'use client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useExtractor } from '@/hooks/use-extractor';
import { enrichContacts } from '@/lib/contacts';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  FileText,
  House,
  Menu,
  Plus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Guides } from './guides';
import { ResultsTable } from './results-table';
import { Sidebar, type GuideType } from './sidebar';
import { UploadPanel, WorkflowCard } from './upload-panel';

export default function Dashboard() {
  const extractor = useExtractor();
  const { contacts, files, job, busy, duplicatesRemoved } = extractor;
  const enriched = useMemo(() => enrichContacts(contacts), [contacts]);
  const [guide, setGuide] = useState<GuideType>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeNavigation = useCallback(() => setMobileOpen(false), []);
  const [confirmation, setConfirmation] = useState<'reset' | 'extract' | null>(null);
  const [exported, setExported] = useState(false);
  const currentStep = exported && contacts.length ? 2 : contacts.length ? 1 : 0;

  function preview() {
    const results = document.getElementById('results');
    results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    results?.focus({ preventScroll: true });
  }
  function reset() {
    if (contacts.length || files.length) setConfirmation('reset');
    else extractor.reset();
  }
  function extract() {
    setExported(false);
    if (contacts.length) setConfirmation('extract');
    else {
      toast.dismiss();
      void extractor.extract();
    }
  }
  function confirm() {
    setExported(false);
    toast.dismiss();
    if (confirmation === 'reset') {
      extractor.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else void extractor.extract();
    setConfirmation(null);
  }

  return (
    <div className="app-shell">
      <Sidebar
        onGuide={setGuide}
        onReset={reset}
        job={job}
        busy={busy}
        mobileOpen={mobileOpen}
        onClose={closeNavigation}
      />
      <div className="main-shell" inert={mobileOpen}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <House size={15} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>Contact extractor</strong>
          </div>
          <div className="topbar-actions">
            <Tooltip content="PDFs are processed temporarily and deleted after extraction.">
              <button className="secure-indicator" onClick={() => setGuide('privacy')}>
                <span />
                Secure workspace
              </button>
            </Tooltip>
            <span className="topbar-divider" />
            <Button variant="ghost" size="sm" onClick={() => setGuide('how')}>
              <CircleHelp size={16} />
              <span>Help & guides</span>
            </Button>
          </div>
        </header>
        <main className="main-content" id="workspace-content" tabIndex={-1}>
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span />A LITTLE LESS MANUAL. A LOT MORE USEFUL.
              </div>
              <h1>
                Extract Names & Phone Numbers
                <br className="hero-break" /> from <span>PDFs.</span>
              </h1>
              <p>
                Upload your PDF and automatically convert contact information
                <br className="desktop-break" /> into clean Excel or CSV files.
              </p>
            </div>
            <Button
              variant="outline"
              className="sample-button"
              onClick={() => setGuide('sample')}
              disabled={busy}
            >
              <FileText size={16} />
              Try a sample
              <ArrowRight size={14} />
            </Button>
          </section>
          <section className="stats-grid" aria-label="Extraction statistics">
            <StatCard
              icon={<UsersRound size={19} />}
              label="Contacts found"
              value={contacts.length}
              note={contacts.length ? 'All your connections, together' : 'Your next list starts here'}
              color="green"
            />
            <StatCard
              icon={<CheckCheck size={20} />}
              label="Valid numbers"
              value={enriched.valid}
              note={
                contacts.length
                  ? `${Math.round((enriched.valid / contacts.length) * 100)}% of extracted numbers`
                  : 'Cleaned and standardized'
              }
              color="blue"
            />
            <StatCard
              icon={<ScanLine size={19} />}
              label="Needs review"
              value={enriched.needsReview}
              note={
                enriched.invalid
                  ? `${enriched.invalid} invalid number${enriched.invalid === 1 ? '' : 's'} to check`
                  : 'A human touch goes a long way'
              }
              color="amber"
            />
            <StatCard
              icon={<FileCheck2 size={19} />}
              label="PDFs processed"
              value={job?.stats?.filesProcessed || 0}
              note={
                job?.files.some((f) => f.usedOcr)
                  ? 'Including OCR-scanned pages'
                  : 'Text or scanned. Both welcome.'
              }
              color="violet"
            />
          </section>
          <div className="workflow-steps" aria-label="Extraction workflow">
            <div className={cn('workflow-step', currentStep === 0 && 'current', currentStep > 0 && 'done')}>
              <span>{currentStep > 0 ? <Check size={12} /> : '01'}</span>
              <strong>Upload your PDFs</strong>
            </div>
            <span className="step-line" />
            <div className={cn('workflow-step', currentStep === 1 && 'current', currentStep > 1 && 'done')}>
              <span>{currentStep > 1 ? <Check size={12} /> : '02'}</span>
              <strong>Review your contacts</strong>
            </div>
            <span className="step-line" />
            <div className={cn('workflow-step', currentStep === 2 && 'current')}>
              <span>03</span>
              <strong>Export & you’re done</strong>
            </div>
            <span className="workflow-time">
              <Sparkles size={13} />
              Less effort. Better data.
            </span>
          </div>
          <div className="upload-layout">
            <UploadPanel
              files={files}
              addFiles={extractor.addFiles}
              removeFile={extractor.removeFile}
              clearFiles={extractor.clearFiles}
              extract={extract}
              cancel={extractor.cancel}
              busy={busy}
              job={job}
              uploadProgress={extractor.uploadProgress}
              error={extractor.error}
              onClearError={() => extractor.setError(null)}
              limits={extractor.limits}
              onPreview={preview}
              onHow={() => setGuide('how')}
            />
            <WorkflowCard onHow={() => setGuide('how')} />
          </div>
          <ResultsTable
            key={job?.id || 'new'}
            contacts={enriched.contacts}
            setContacts={extractor.setContacts}
            onExport={() => setExported(true)}
            groups={enriched.groups}
            duplicates={enriched.duplicates}
            duplicatesRemoved={duplicatesRemoved}
            onDuplicatesRemoved={(count) =>
              extractor.setDuplicatesRemoved((prev) => Math.max(0, prev + count))
            }
            job={job}
            busy={busy}
            onSample={() => setGuide('sample')}
          />
          <footer className="page-footer">
            <span>
              <span className="footer-mark">
                <FileText size={13} />
              </span>
              Made for your workflow. Not more work.
            </span>
            <button onClick={() => setGuide('privacy')}>
              <ShieldCheck size={13} />
              Private by default. Always.
            </button>
          </footer>
        </main>
      </div>
      <Guides guide={guide} onClose={() => setGuide(null)} onSample={(file) => extractor.addFiles([file])} />
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={confirmation === 'reset' ? 'A fresh start?' : 'Extract a new contact list?'}
        description={
          confirmation === 'reset'
            ? 'This clears your files, contacts, and edits, and requests deletion of your server result. Download anything you’d like to keep first.'
            : 'This extraction will replace your current contacts and edits. Export your current list first if you’d like to keep it.'
        }
      >
        <div className="dialog-footer">
          <Button variant="outline" onClick={() => setConfirmation(null)}>
            Keep working
          </Button>
          <Button onClick={confirm}>
            {confirmation === 'reset' ? (
              <>
                <Plus size={15} />
                Start fresh
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Extract contacts
              </>
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
function StatCard({
  icon,
  label,
  value,
  note,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={cn('stat-icon', `stat-icon-${color}`)}>{icon}</span>
      </div>
      <div className="stat-value">
        {value.toLocaleString()}
        <span className={cn('stat-value-dot', value > 0 && 'has-value')} />
      </div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
