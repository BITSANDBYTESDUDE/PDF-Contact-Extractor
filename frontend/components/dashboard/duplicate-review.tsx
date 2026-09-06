'use client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { plural } from '@/lib/utils';
import type { Contact } from '@/types';
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

export function DuplicateReview({
  groups,
  onClose,
  onRemove,
}: {
  groups: [string, Contact[]][];
  onClose: () => void;
  onRemove: (ids: string[]) => void;
}) {
  const [plan, setPlan] = useState(() =>
    Object.fromEntries(
      groups.map(([key, rows]) => {
        const names = new Set(
          rows.map((r) => r.name.toLocaleLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean),
        );
        const keeper = [...rows].sort(
          (a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || b.confidence - a.confidence,
        )[0];
        return [
          key,
          {
            selected: names.size <= 1,
            keepId: keeper.id,
            conflict: names.size > 1,
            rowPage: Math.floor(rows.findIndex((r) => r.id === keeper.id) / 20) + 1,
          },
        ];
      }),
    ),
  );
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(groups.length / 5);
  const removeIds = useMemo(
    () =>
      groups.flatMap(([key, rows]) =>
        plan[key].selected ? rows.filter((r) => r.id !== plan[key].keepId).map((r) => r.id) : [],
      ),
    [groups, plan],
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="A few familiar numbers."
      description={`${plural(groups.length, 'group')} share the same verified phone number. Review each group and choose which contact to keep.`}
      className="duplicate-dialog"
    >
      <div className="info-panel duplicate-notice">
        <ShieldCheck size={20} />
        <div>
          <strong>You’re in control of every merge.</strong>
          <p>
            Different names may represent different people. Those groups are never preselected. Only checked
            groups will be merged.
          </p>
        </div>
      </div>
      <div className="duplicate-groups">
        {groups.slice((page - 1) * 5, page * 5).map(([key, rows]) => (
          <div key={key} className="duplicate-group">
            <div className="duplicate-group-head">
              <Checkbox
                checked={plan[key].selected}
                onCheckedChange={(checked) =>
                  setPlan((p) => ({ ...p, [key]: { ...p[key], selected: !!checked } }))
                }
                aria-label={`Merge group ${key}`}
              />
              <strong>{rows[0].phone}</strong>
              <span>{rows.length} matches</span>
              {plan[key].conflict && (
                <span className="conflict-badge">
                  <AlertTriangle size={12} />
                  Different names
                </span>
              )}
            </div>
            <div className="duplicate-group-rows">
              {rows.slice((plan[key].rowPage - 1) * 20, plan[key].rowPage * 20).map((row) => (
                <label className="duplicate-option" key={row.id}>
                  <input
                    type="radio"
                    name={`keep-${key}`}
                    value={row.id}
                    checked={plan[key].keepId === row.id}
                    onChange={() => setPlan((p) => ({ ...p, [key]: { ...p[key], keepId: row.id } }))}
                  />
                  <span>
                    <strong>{row.name || 'Name not found'}</strong>
                    <small>
                      {row.sourceFile} · Page {row.sourcePage}
                    </small>
                  </span>
                  <span className={plan[key].keepId === row.id ? 'keep-label' : 'remove-label'}>
                    {plan[key].keepId === row.id ? 'Keep' : plan[key].selected ? 'Remove' : 'Unchanged'}
                  </span>
                </label>
              ))}
            </div>
            {rows.length > 20 && (
              <div className="duplicate-pagination duplicate-row-pagination">
                <span>
                  Matches {(plan[key].rowPage - 1) * 20 + 1}–{Math.min(plan[key].rowPage * 20, rows.length)}{' '}
                  of {rows.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Previous matches for ${key}`}
                  disabled={plan[key].rowPage === 1}
                  onClick={() =>
                    setPlan((p) => ({ ...p, [key]: { ...p[key], rowPage: p[key].rowPage - 1 } }))
                  }
                >
                  <ChevronLeft size={15} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Next matches for ${key}`}
                  disabled={plan[key].rowPage * 20 >= rows.length}
                  onClick={() =>
                    setPlan((p) => ({ ...p, [key]: { ...p[key], rowPage: p[key].rowPage + 1 } }))
                  }
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="duplicate-pagination">
          <span>
            Groups {(page - 1) * 5 + 1}–{Math.min(page * 5, groups.length)} of {groups.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous duplicate groups"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={page === pageCount}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next duplicate groups"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
      <div className="dialog-footer">
        <Button variant="outline" onClick={onClose}>
          Keep everything
        </Button>
        <Button disabled={!removeIds.length} onClick={() => onRemove(removeIds)}>
          <Copy size={15} />
          Remove {plural(removeIds.length, 'duplicate')}
        </Button>
      </div>
    </Dialog>
  );
}
