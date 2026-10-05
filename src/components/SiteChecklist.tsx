'use client';

import { useState } from 'react';
import { factRecorded } from '@/lib/siteAnalysis';
import { SITE_CATEGORIES, siteStatus } from '@/lib/siteChecklist';
import type { SiteFact } from '@/types/slide';

/** The Site checklist beside a Site analysis stage's plan (S2): the site's
 *  facts, grouped by category, each with its value and status. It takes the
 *  Seating Capacity table's place on this stage, at the same width, and
 *  collapses and closes the same way.
 *
 *  Nothing is edited here. In the editor a click selects the row and the
 *  Properties panel shows its fields at full size, since controls drawn inside
 *  the scaled slide come out tiny (U9). Presenter shows only the rows with
 *  something recorded, and a click on one with a note shows the note. */
export function SiteChecklist({
  facts,
  editable,
  selectedId,
  onSelect,
}: {
  facts: SiteFact[];
  editable: boolean;
  selectedId: string | null;
  onSelect?: (factId: string) => void;
}) {
  // Viewer conveniences, not deck content: kept local, like the seating
  // table's, so collapsing it while presenting never edits the deck.
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const shown = editable ? facts : facts.filter(factRecorded);
  if (!shown.length) return null;
  const checked = facts.filter((f) => f.status).length;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        title="Show the site checklist"
        className="flex h-full w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-wide">Checklist</span>
      </button>
    );
  }

  const groups = SITE_CATEGORIES.map((category) => ({ category, rows: shown.filter((f) => f.category === category.key) })).filter((g) => g.rows.length);

  return (
    <div className={`flex h-full min-h-0 shrink-0 flex-col gap-2 ${collapsed ? 'w-auto' : 'w-72'}`}>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Show the site checklist' : 'Hide the site checklist'}
          className="shrink-0 text-[9px] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          <span className={`inline-block transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          title="Close the site checklist"
          className="shrink-0 text-[10px] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
        <span className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-[var(--ink)]">Site checklist</span>
        {editable && !collapsed && (
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--ink-3)]" title="Rows with a status">
            {checked} of {facts.length} checked
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
          {groups.map(({ category, rows }) => (
            <div key={category.key} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                {category.label}
              </div>
              {rows.map((fact) => {
                const status = siteStatus(fact.status);
                const selected = editable && fact.id === selectedId;
                const opensNote = !editable && !!fact.note;
                const noteOpen = opensNote && openNoteId === fact.id;
                const rowClass = 'flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors';
                const content = (
                  <>
                    <span className="min-w-0 flex-1 text-[var(--ink-2)]">
                      {fact.label}
                      {opensNote && <span className="ml-1 text-[9px] text-[var(--ink-3)]">{noteOpen ? '▴' : '▾'}</span>}
                    </span>
                    {fact.value && <span className="max-w-[48%] shrink-0 text-right font-semibold text-[var(--ink)]">{fact.value}</span>}
                    <span
                      role="img"
                      aria-label={status?.label ?? 'Not checked'}
                      title={status?.label ?? 'Not checked'}
                      className={`relative top-px h-2 w-2 shrink-0 rounded-full ${status ? '' : editable ? 'border border-[var(--ink-3)]' : 'hidden'}`}
                      style={status ? { backgroundColor: status.color } : undefined}
                    />
                  </>
                );
                return (
                  <div key={fact.id} className="flex flex-col">
                    {editable || opensNote ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          if (editable) {
                            onSelect?.(fact.id);
                            return;
                          }
                          setOpenNoteId((cur) => (cur === fact.id ? null : fact.id));
                          // Presenter's own keys (Space, the arrows) mustn't press it again.
                          e.currentTarget.blur();
                        }}
                        title={editable ? 'Edit this row in the Properties panel' : noteOpen ? 'Hide the note' : 'Show the note'}
                        className={`${rowClass} ${selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                    {noteOpen && <p className="px-1.5 pb-1 text-[10px] leading-snug text-[var(--ink-3)]">{fact.note}</p>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
