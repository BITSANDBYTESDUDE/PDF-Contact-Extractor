'use client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { downloadContacts } from '@/lib/api';
import { plural } from '@/lib/utils';
import type { Contact } from '@/types';
import { AlertCircle, Download, FileText, Loader2, Sheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function ExportDialog({
  onExport,
  format,
  all,
  filtered,
  selected,
  hasFilter,
  onClose,
}: {
  onExport: () => void;
  format: 'xlsx' | 'csv';
  all: Contact[];
  filtered: Contact[];
  selected: Contact[];
  hasFilter: boolean;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>(
    selected.length ? 'selected' : hasFilter ? 'filtered' : 'all',
  );
  const [safeCsv, setSafeCsv] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const rows = scope === 'all' ? all : scope === 'filtered' ? filtered : selected;
  const needsReview = rows.filter((r) => r.status !== 'valid').length;
  async function download() {
    setDownloading(true);
    try {
      await downloadContacts(rows, format, safeCsv);
      toast.success(`${plural(rows.length, 'contact')} exported to ${format === 'xlsx' ? 'Excel' : 'CSV'}.`);
      onExport();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The export failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !downloading) onClose();
      }}
      title="Ready for your next step."
      description="Your current edits will be included. Choose which contacts to take with you."
      className="export-dialog"
    >
      <div className="export-file-preview">
        <span>{format === 'xlsx' ? <Sheet size={26} /> : <FileText size={26} />}</span>
        <div>
          <strong>{format === 'xlsx' ? 'Excel workbook' : 'CSV file'}</strong>
          <small>
            extracted-contacts-{new Date().toISOString().slice(0, 10)}.{format}
          </small>
        </div>
        <span className="export-extension">.{format}</span>
      </div>
      <fieldset className="export-scopes">
        <legend>CONTACTS TO EXPORT</legend>
        {(
          [
            ['all', 'All contacts', all.length],
            ['filtered', 'Current filtered view', filtered.length],
            ['selected', 'Selected contacts', selected.length],
          ] as const
        ).map(([value, label, count]) => (
          <label key={value} className={scope === value ? 'export-scope checked' : 'export-scope'}>
            <input
              type="radio"
              name="export-scope"
              checked={scope === value}
              onChange={() => setScope(value)}
              disabled={!count || downloading}
            />
            <span>{label}</span>
            <span>{count.toLocaleString()}</span>
          </label>
        ))}
      </fieldset>
      {format === 'csv' && (
        <div className="csv-options">
          <label>
            <Checkbox checked={safeCsv} onCheckedChange={(value) => setSafeCsv(!!value)} />
            Spreadsheet-safe phone numbers
          </label>
          <p>
            {safeCsv
              ? 'Prefixes phones with an apostrophe to preserve leading zeroes. Recommended when opening CSV in a spreadsheet.'
              : 'Raw phone values for CRM imports. Spreadsheet apps may remove leading zeroes. Choose Excel for guaranteed text cells.'}
          </p>
        </div>
      )}
      {!!needsReview && (
        <div className="review-export-warning">
          <AlertCircle size={17} />
          <span>
            {plural(needsReview, 'contact')} still {needsReview === 1 ? 'needs' : 'need'} review. These will
            be exported as shown.
          </span>
        </div>
      )}
      <p className="export-columns">
        Included columns: <strong>Name · Phone Number · Source File</strong>
      </p>
      <div className="dialog-footer">
        <Button variant="outline" onClick={onClose} disabled={downloading}>
          Cancel
        </Button>
        <Button onClick={download} disabled={!rows.length || downloading}>
          {downloading ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
          {downloading ? 'Preparing download…' : `Download ${format === 'xlsx' ? 'Excel' : 'CSV'}`}
        </Button>
      </div>
    </Dialog>
  );
}
