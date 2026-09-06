'use client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  ArrowRight,
  Check,
  FileText,
  Globe2,
  Loader2,
  LockKeyhole,
  ScanText,
  Sheet,
  ShieldCheck,
  Table2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { GuideType } from './sidebar';

export function Guides({
  guide,
  onClose,
  onSample,
}: {
  guide: GuideType;
  onClose: () => void;
  onSample: (file: File) => void;
}) {
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  async function loadSample(scanned: boolean) {
    const filename = scanned ? 'scanned-contacts.pdf' : 'sample-contacts.pdf';
    setLoadingSample(filename);
    try {
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) throw new Error('The sample could not be loaded. Please try again.');
      const blob = await response.blob();
      onSample(new File([blob], filename, { type: 'application/pdf', lastModified: 0 }));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sample unavailable.');
    } finally {
      setLoadingSample(null);
    }
  }
  const titles = {
    how: 'From PDF to your next connection.',
    export: 'A clean handoff, every time.',
    privacy: 'Your data deserves a little care.',
    sample: 'Take it for a spin.',
  };
  const descriptions = {
    how: 'Three simple steps. No setup, spreadsheets, or copy-pasting required.',
    export: 'Choose the format that fits your next step.',
    privacy: 'Here’s exactly what happens to your documents and contacts.',
    sample: 'Try a real sample document. Nothing is added to your results until you extract it.',
  };
  return (
    <Dialog
      open={!!guide}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={guide ? titles[guide] : ''}
      description={guide ? descriptions[guide] : ''}
      className="guide-dialog"
    >
      {guide === 'sample' && (
        <div className="sample-options">
          <button className="sample-option" disabled={!!loadingSample} onClick={() => loadSample(false)}>
            <span className="sample-file-icon">
              <FileText size={26} strokeWidth={1.5} />
            </span>
            <span>
              <strong>
                Text-based PDF <span className="tiny-badge">START HERE</span>
              </strong>
              <p>A small contact list with varied layouts, a duplicate, and a missing name to review.</p>
              <small>1 page · Selectable text</small>
            </span>
            {loadingSample === 'sample-contacts.pdf' ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
          <button className="sample-option" disabled={!!loadingSample} onClick={() => loadSample(true)}>
            <span className="sample-file-icon scan">
              <ScanText size={26} strokeWidth={1.5} />
            </span>
            <span>
              <strong>Scanned PDF</strong>
              <p>An image-only contact sheet. Watch automatic OCR turn the scan into editable data.</p>
              <small>1 page · OCR-enabled</small>
            </span>
            {loadingSample === 'scanned-contacts.pdf' ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
          <div className="soft-note">
            <LockKeyhole size={15} /> Samples are synthetic and contain no real customer information.
          </div>
        </div>
      )}
      {guide === 'how' && (
        <div className="guide-content">
          <div className="guide-step">
            <span>
              <Upload size={20} />
            </span>
            <div>
              <h3>01. Drop in your documents</h3>
              <p>
                Select up to 10 PDFs, 25 MB each (100 MB combined). Text PDFs and scanned pages are supported,
                including mixed documents.
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span>
              <ScanText size={20} />
            </span>
            <div>
              <h3>02. Let us handle the reading</h3>
              <p>
                We reconstruct text layouts, automatically use OCR when needed, and match phone numbers to
                nearby names. Uncertain matches are flagged, never invented.
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span>
              <Table2 size={20} />
            </span>
            <div>
              <h3>03. Give it a final check</h3>
              <p>
                Edit a row with the pencil icon, filter contacts that need review, and decide which duplicates
                to keep. Then export your final list.
              </p>
            </div>
          </div>
          <div className="info-panel">
            <Globe2 size={19} />
            <div>
              <strong>Built with Pakistani numbers in mind</strong>
              <p>
                Local formats like 0300-1234567 and +92 300 1234567 are recognized as the same number.
                International numbers need a + or 00 country code.
              </p>
            </div>
          </div>
          <div className="guide-footnote">
            Tip: press <kbd>Enter</kbd> to save a row, or <kbd>Esc</kbd> to cancel an edit. Extraction is
            heuristic — always review important data.
          </div>
        </div>
      )}
      {guide === 'export' && (
        <div className="guide-content">
          <div className="export-format-card">
            <span className="format-icon">
              <Sheet size={26} />
            </span>
            <div>
              <h3>
                Excel workbook <span className="tiny-badge">RECOMMENDED</span>
              </h3>
              <p>
                A formatted .xlsx file with Name, Phone Number, and Source File columns. Phone cells are
                explicitly stored as text, preserving leading zeroes and + prefixes.
              </p>
            </div>
          </div>
          <div className="export-format-card">
            <span className="format-icon neutral">
              <FileText size={26} />
            </span>
            <div>
              <h3>CSV file</h3>
              <p>
                A UTF-8, comma-separated file. Spreadsheet-safe mode prefixes phone numbers with an apostrophe
                to prevent number conversion. Use “Raw phone values” for importing into a CRM.
              </p>
            </div>
          </div>
          <div className="info-panel">
            <ShieldCheck size={19} />
            <div>
              <strong>Your edits come with you</strong>
              <p>
                Exports always use the current edited rows. Export all contacts, just your filtered view, or
                selected rows. Potential formulas in text are safely escaped.
              </p>
            </div>
          </div>
          <p className="guide-footnote">
            CSV has no cell types. For a clean, guaranteed text display in Excel, choose .xlsx. Raw CSV
            retains leading zeroes in the file, but spreadsheet apps may convert them when opened.
          </p>
        </div>
      )}
      {guide === 'privacy' && (
        <div className="guide-content">
          <div className="privacy-promise">
            <ShieldCheck size={35} strokeWidth={1.3} />
            <h3>Temporary by intention.</h3>
            <p>
              No account. No permanent document storage.
              <br />
              No third-party AI processing.
            </p>
          </div>
          <ul className="privacy-list">
            <li>
              <Check size={17} />
              <span>
                <strong>Files are deleted after processing.</strong> Temporary PDFs use random filenames in a
                restricted server directory. Cancellation and timeouts also trigger cleanup.
              </span>
            </li>
            <li>
              <Check size={17} />
              <span>
                <strong>Results are short-lived.</strong> Server results expire within 30 minutes (or sooner
                under load). Edits live only in this browser tab, never in local storage.
              </span>
            </li>
            <li>
              <Check size={17} />
              <span>
                <strong>Start fresh, genuinely.</strong> “New extraction” clears your workspace and requests
                deletion of the server-side result. Closing or reloading the tab clears browser data.
              </span>
            </li>
            <li>
              <Check size={17} />
              <span>
                <strong>Your exports are yours to keep.</strong> Downloaded files remain on your device. We
                don’t keep copies of exports.
              </span>
            </li>
          </ul>
          <div className="soft-note">
            <LockKeyhole size={15} /> Only upload documents you have permission to process.
          </div>
        </div>
      )}
      {guide !== 'sample' && (
        <div className="dialog-footer">
          <Button onClick={onClose}>
            Got it <Check size={15} />
          </Button>
        </div>
      )}
    </Dialog>
  );
}
