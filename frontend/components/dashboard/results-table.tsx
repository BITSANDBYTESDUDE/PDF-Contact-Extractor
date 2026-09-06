'use client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { updateContact, validatePhone } from '@/lib/contacts';
import { cn, plural } from '@/lib/utils';
import type { Contact, ExtractionJob } from '@/types';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FileText,
  ListFilter,
  Pencil,
  Search,
  Sheet,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { DuplicateReview } from './duplicate-review';
import { ExportDialog } from './export-dialog';

type Filter = 'all' | 'valid' | 'needs-review' | 'invalid' | 'duplicates';
type Sort = 'original' | 'name' | 'phone' | 'sourceFile' | 'status';
interface Props {
  onExport: () => void;
  contacts: Contact[];
  setContacts: Dispatch<SetStateAction<Contact[]>>;
  groups: [string, Contact[]][];
  duplicates: number;
  duplicatesRemoved: number;
  onDuplicatesRemoved: (count: number) => void;
  job: ExtractionJob | null;
  busy: boolean;
  onSample: () => void;
}

export function ResultsTable({
  onExport,
  contacts,
  setContacts,
  groups,
  duplicates,
  duplicatesRemoved,
  onDuplicatesRemoved,
  job,
  busy,
  onSample,
}: Props) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState<Sort>('original');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', phone: '' });
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [reviewDuplicates, setReviewDuplicates] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | null>(null);

  const files = useMemo(() => [...new Set(contacts.map((c) => c.sourceFile))], [contacts]);
  const indexById = useMemo(() => new Map(contacts.map((c, index) => [c.id, index + 1])), [contacts]);
  const selectedContacts = useMemo(() => contacts.filter((c) => selected.has(c.id)), [contacts, selected]);
  const filtered = useMemo(() => {
    const text = deferredQuery.toLocaleLowerCase().trim();
    const digits = text.replace(/\D/g, '');
    let rows = contacts.filter((contact) => {
      const matchQuery =
        !text ||
        [contact.name, contact.phone, contact.sourceFile].some((v) => v.toLocaleLowerCase().includes(text)) ||
        (digits.length >= 3 &&
          !/[a-z]/i.test(text) &&
          [contact.phone, contact.normalizedPhone || ''].some((v) => v.replace(/\D/g, '').includes(digits)));
      return (
        matchQuery &&
        (source === 'all' || contact.sourceFile === source) &&
        (filter === 'all' ||
          (filter === 'duplicates'
            ? !!contact.duplicateGroup
            : filter === 'needs-review'
              ? contact.status !== 'valid'
              : contact.status === filter))
      );
    });
    if (sort !== 'original')
      rows = [...rows].sort(
        (a, b) =>
          a[sort].localeCompare(b[sort], undefined, { numeric: true, sensitivity: 'base' }) *
          (direction === 'asc' ? 1 : -1),
      );
    return rows;
  }, [contacts, deferredQuery, filter, source, sort, direction]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedOnPage = visible.filter((c) => selected.has(c.id)).length;
  const hasFilter = !!query || filter !== 'all' || source !== 'all';
  const allFilteredSelected = !!filtered.length && filtered.every((c) => selected.has(c.id));

  function toggleSort(column: Sort) {
    if (sort === column) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(column);
      setDirection('asc');
    }
    setPage(1);
  }
  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((c) => {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      });
      return next;
    });
  }
  function startEditing(contact: Contact) {
    setEditing(contact.id);
    setDraft({ name: contact.name, phone: contact.phone });
  }
  function saveEdit(contact: Contact) {
    if (!draft.phone.trim()) {
      toast.error('A phone number is required. Delete the row if it isn’t a contact.');
      return;
    }
    const updated = updateContact(contact, draft.name, draft.phone);
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
    setEditing(null);
    toast.success(updated.status === 'valid' ? 'Contact updated.' : 'Contact saved and flagged for review.');
  }
  function remove(ids: string[], duplicate = false) {
    const idSet = new Set(ids);
    const removed = contacts.filter((c) => idSet.has(c.id));
    setContacts((prev) => prev.filter((c) => !idSet.has(c.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !idSet.has(id))));
    setDeleteIds([]);
    setReviewDuplicates(false);
    if (duplicate) onDuplicatesRemoved(removed.length);
    toast.success(`${plural(removed.length, duplicate ? 'duplicate' : 'contact')} removed.`, {
      duration: 7000,
      action: {
        label: 'Undo',
        onClick: () => {
          setContacts((prev) => {
            const existing = new Set(prev.map((c) => c.id));
            return [...prev, ...removed.filter((r) => !existing.has(r.id))];
          });
          if (duplicate) onDuplicatesRemoved(-removed.length);
        },
      },
    });
  }
  function resetFilters() {
    setQuery('');
    setFilter('all');
    setSource('all');
    setPage(1);
  }
  function sortIcon(column: Sort) {
    return sort === column ? (
      direction === 'asc' ? (
        <ArrowUp size={13} />
      ) : (
        <ArrowDown size={13} />
      )
    ) : (
      <ArrowUpDown size={12} />
    );
  }

  return (
    <section className="results-section" id="results" aria-labelledby="results-title" tabIndex={-1}>
      <div className="results-heading">
        <div>
          <div className="results-title-line">
            <h2 id="results-title">Extracted contacts</h2>
            <span className="count-badge">{contacts.length.toLocaleString()}</span>
          </div>
          <p>
            {contacts.length
              ? 'A little review now. A perfectly organized list next.'
              : 'From scattered information to something you can work with.'}
          </p>
        </div>
        <div className="export-buttons">
          <Button
            variant="outline"
            onClick={() => setExportFormat('csv')}
            disabled={!contacts.length || busy || !!editing}
          >
            <Download size={15} />
            Download CSV
          </Button>
          <Button onClick={() => setExportFormat('xlsx')} disabled={!contacts.length || busy || !!editing}>
            <Sheet size={16} />
            Download Excel
          </Button>
        </div>
      </div>
      {job?.status === 'complete' && !busy && (
        <div className="completion-banner">
          <span className="completion-check">
            <Check size={16} />
          </span>
          <div>
            <strong>Extraction complete</strong>
            <span>
              {plural(job.stats?.total || 0, 'contact')} found in{' '}
              {plural(job.stats?.filesProcessed || 0, 'PDF')}. Your list is ready for a final check.
            </span>
          </div>
          <Tooltip content="The original PDFs have been deleted from temporary server storage.">
            <span className="files-deleted">
              <ShieldCheck size={14} />
              PDFs deleted
            </span>
          </Tooltip>
        </div>
      )}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search contacts"
              placeholder="Search name, number, or file…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              disabled={!contacts.length}
            />
            {query ? (
              <button
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
              >
                <X size={13} />
              </button>
            ) : (
              <span className="search-hint">Search</span>
            )}
          </div>
          <div className="table-filters">
            <div className="select-wrap">
              <ListFilter size={14} />
              <select
                aria-label="Filter contact status"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as Filter);
                  setPage(1);
                }}
                disabled={!contacts.length}
              >
                <option value="all">All contacts</option>
                <option value="valid">Ready to export</option>
                <option value="needs-review">Needs review</option>
                <option value="invalid">Invalid numbers</option>
                <option value="duplicates">Duplicates</option>
              </select>
              <ChevronDown size={13} />
            </div>
            {files.length > 1 && (
              <div className="select-wrap source-select">
                <FileText size={14} />
                <select
                  aria-label="Filter source file"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All source files</option>
                  {files.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </div>
            )}
            {!!duplicates && (
              <Button
                variant="outline"
                size="sm"
                className="duplicate-button"
                onClick={() => setReviewDuplicates(true)}
                disabled={busy || !!editing}
              >
                <Copy size={14} />
                <span>
                  {duplicates} duplicate{duplicates === 1 ? '' : 's'}
                </span>
                <span className="review-link">Review</span>
              </Button>
            )}
          </div>
        </div>
        {!!selectedContacts.length && (
          <div className="selection-bar">
            <span>
              <strong>{selectedContacts.length}</strong> selected
            </span>
            <button onClick={() => setSelected(new Set())}>Clear selection</button>
            {!allFilteredSelected && (
              <button
                className="select-all-matching"
                onClick={() => setSelected(new Set(filtered.map((c) => c.id)))}
              >
                Select all {filtered.length} matching
              </button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteIds(selectedContacts.map((c) => c.id))}
              disabled={busy}
            >
              <Trash2 size={14} />
              Delete selected
            </Button>
          </div>
        )}
        <div className="table-scroll">
          <table className="contacts-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <Checkbox
                    checked={
                      visible.length > 0 && selectedOnPage === visible.length
                        ? true
                        : selectedOnPage
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(value) => togglePage(!!value)}
                    disabled={!visible.length || busy}
                    aria-label="Select all contacts on this page"
                  />
                </th>
                <th className="number-cell">#</th>
                <th>
                  <button onClick={() => toggleSort('name')}>Full name{sortIcon('name')}</button>
                </th>
                <th>
                  <button onClick={() => toggleSort('phone')}>Phone number{sortIcon('phone')}</button>
                </th>
                <th>
                  <button onClick={() => toggleSort('sourceFile')}>
                    Source file{sortIcon('sourceFile')}
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('status')}>Status{sortIcon('status')}</button>
                </th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contact) => (
                <tr
                  key={contact.id}
                  className={cn(
                    selected.has(contact.id) && 'row-selected',
                    editing === contact.id && 'row-editing',
                  )}
                >
                  <td className="checkbox-cell">
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={(checked) => toggleSelected(contact.id, !!checked)}
                      aria-label={`Select ${contact.name || contact.phone}`}
                      disabled={busy}
                    />
                  </td>
                  <td className="number-cell">{indexById.get(contact.id)}</td>
                  <td>
                    {editing === contact.id ? (
                      <input
                        autoFocus
                        className="cell-input name-input"
                        aria-label="Edit full name"
                        placeholder="Full name"
                        maxLength={150}
                        value={draft.name}
                        onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveEdit(contact);
                          if (event.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span className={cn('contact-name', !contact.name && 'missing-name')}>
                        {contact.name || 'Name not found'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editing === contact.id ? (
                      <input
                        className={cn(
                          'cell-input phone-input',
                          draft.phone && !validatePhone(draft.phone) && 'input-warning',
                        )}
                        aria-label="Edit phone number"
                        maxLength={50}
                        value={draft.phone}
                        onChange={(event) => setDraft((d) => ({ ...d, phone: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveEdit(contact);
                          if (event.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span className="contact-phone">{contact.phone}</span>
                    )}
                  </td>
                  <td>
                    <Tooltip content={`${contact.sourceFile} · Page ${contact.sourcePage}`}>
                      <span className="source-file" tabIndex={0}>
                        <FileText size={14} />
                        <span>{contact.sourceFile}</span>
                      </span>
                    </Tooltip>
                  </td>
                  <td>
                    <Tooltip
                      content={
                        contact.reviewReason ||
                        (contact.duplicateGroup
                          ? 'This verified phone number appears more than once. Review duplicates before removing any.'
                          : 'The phone number is valid and the name has been matched.')
                      }
                    >
                      <span
                        className={cn(
                          'status-badge',
                          contact.status === 'invalid'
                            ? 'status-invalid'
                            : contact.status === 'needs-review'
                              ? 'status-review'
                              : contact.duplicateGroup
                                ? 'status-duplicate'
                                : 'status-valid',
                        )}
                        tabIndex={0}
                      >
                        {contact.status === 'invalid' ? (
                          <>
                            <CircleHelp size={11} />
                            Invalid number
                          </>
                        ) : contact.status === 'needs-review' ? (
                          <>
                            <span className="status-dot" />
                            Needs review
                          </>
                        ) : contact.duplicateGroup ? (
                          <>
                            <Copy size={10} />
                            Duplicate
                          </>
                        ) : (
                          <>
                            <Check size={11} />
                            Ready
                          </>
                        )}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="actions-cell">
                    <div className="row-actions">
                      {editing === contact.id ? (
                        <>
                          <button
                            aria-label="Save contact"
                            className="icon-button save-edit"
                            onClick={() => saveEdit(contact)}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            aria-label="Cancel editing"
                            className="icon-button"
                            onClick={() => setEditing(null)}
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Tooltip content="Edit contact">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${contact.name || contact.phone}`}
                              disabled={busy}
                              onClick={() => startEditing(contact)}
                            >
                              <Pencil size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete contact">
                            <button
                              className="icon-button delete-action"
                              aria-label={`Delete ${contact.name || contact.phone}`}
                              disabled={busy}
                              onClick={() => setDeleteIds([contact.id])}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className={cn('results-empty', contacts.length > 0 && 'results-empty-filtered')}>
            {contacts.length ? (
              <>
                <span className="empty-search">
                  <Search size={26} strokeWidth={1.4} />
                </span>
                <h3>No contacts match just yet.</h3>
                <p>Try another search or give your filters a fresh start.</p>
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <div className="empty-contacts-illustration" aria-hidden="true">
                  <span className="empty-card empty-card-back" />
                  <span className="empty-card">
                    <UsersRound size={25} strokeWidth={1.25} />
                    <span>
                      <i />
                      <i />
                    </span>
                    <span className="empty-check">
                      <Check size={10} />
                    </span>
                  </span>
                </div>
                <h3>
                  {busy
                    ? 'Reading between the lines…'
                    : job?.status === 'complete'
                      ? job.stats?.total
                        ? 'Your list is clear.'
                        : 'No contacts found this time.'
                      : 'Your next connection starts here.'}
                </h3>
                <p>
                  {busy
                    ? 'We’re turning your documents into something a little more organized.'
                    : job?.status === 'complete'
                      ? job.stats?.total
                        ? 'All contacts in this batch have been removed. You can start with a new PDF.'
                        : 'Check the file details above, or try a clearer document.'
                      : 'Upload a PDF above. We’ll bring the names and numbers together.'}
                </p>
                {!busy && (
                  <button className="empty-sample-link" onClick={onSample}>
                    Just exploring? Try a sample PDF <ArrowUpDown size={12} className="rotate-arrow" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length ? (
              <>
                Showing{' '}
                <strong>
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}
                </strong>{' '}
                of <strong>{filtered.length.toLocaleString()}</strong> contacts
              </>
            ) : (
              'No contacts to display'
            )}
            {duplicatesRemoved > 0 && (
              <span className="deduped-note"> · {duplicatesRemoved} duplicates removed</span>
            )}
          </span>
          <div className="pagination">
            <label>
              Rows per page{' '}
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
                <option>100</option>
              </select>
            </label>
            <span>
              {currentPage} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              aria-label="Previous page"
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= pages}
              aria-label="Next page"
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </div>
      <div className="results-tip">
        <span>
          <Pencil size={12} />A name not quite right? Click the pencil to make it yours.
        </span>
        <span>
          <ShieldCheck size={12} />
          You review. You decide. You export.
        </span>
      </div>
      {!!deleteIds.length && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteIds([]);
          }}
          title={`Remove ${plural(deleteIds.length, 'contact')}?`}
          description="These contacts will be removed from your list and future exports. You can undo immediately after deleting."
        >
          <div className="dialog-footer">
            <Button variant="outline" onClick={() => setDeleteIds([])}>
              Keep contacts
            </Button>
            <Button variant="destructive" onClick={() => remove(deleteIds)}>
              <Trash2 size={15} />
              Remove {deleteIds.length === 1 ? 'contact' : 'contacts'}
            </Button>
          </div>
        </Dialog>
      )}
      {reviewDuplicates && groups.length > 0 && (
        <DuplicateReview
          groups={groups}
          onClose={() => setReviewDuplicates(false)}
          onRemove={(ids) => remove(ids, true)}
        />
      )}
      {exportFormat && (
        <ExportDialog
          onExport={onExport}
          format={exportFormat}
          all={contacts}
          filtered={filtered}
          selected={selectedContacts}
          hasFilter={hasFilter}
          onClose={() => setExportFormat(null)}
        />
      )}
    </section>
  );
}
