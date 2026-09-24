'use client';

import { useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { parseSeatingWorkbook } from '@/lib/importExcel';
import { makeId } from '@/lib/id';
import type { LinkedView, SeatingRow, SeatingZone, ViewHotspot } from '@/types/slide';

/** The Area/Required/Achieved capacity table shown beside a linked view's
 *  plan, grouped by zone and two-way hover-linked to the plan's own
 *  hotspots — modeled directly on the reference deck's "Seating Capacity"
 *  panel (sidvin-design-deck/index4.html), which lives beside the plan it
 *  describes rather than off on a separate slide. Replaces the earlier
 *  separate occupancy-chart slide + click-jump design. */
export function SeatingTable({
  view,
  hotspots,
  editable,
  hoveredHotspotId,
  onHoverHotspots,
  onChangeView,
  onSelectHotspot,
}: {
  view: LinkedView;
  hotspots: ViewHotspot[];
  editable: boolean;
  /** Set when a hotspot on the plan is hovered — highlights any row(s) that
   *  link to it, the reverse of a row hover highlighting the plan. */
  hoveredHotspotId: string | null;
  onHoverHotspots: (ids: string[]) => void;
  onChangeView: (patch: Partial<LinkedView>) => void;
  /** Click-to-jump for a row linked to exactly one hotspot — mirrors
   *  HotspotSidePanel's own click-through, giving the seating table parity
   *  with it (a row could otherwise only hover-highlight, never actually
   *  open the space it's about). A row linked to several hotspots (e.g. a
   *  group header) has no single obvious target, so it stays hover-only. */
  onSelectHotspot?: (hotspotId: string) => void;
}) {
  const zones = view.seatingZones ?? [];
  // A viewer convenience, not authored content — like the key-plan card's
  // own visible/expanded state, it stays local rather than persisted, so
  // collapsing it while presenting never edits the deck.
  const [collapsed, setCollapsed] = useState(false);
  // Goes further than collapsed: no title bar left at all, just a narrow
  // reopen tab (see the early return below) — same non-persisted
  // convenience, same free reset on every view/stage switch (a fresh mount).
  const [hidden, setHidden] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Parsed but not yet committed — a bad spreadsheet can be reviewed and
  // discarded before it touches `zones`, rather than relying on the app's
  // global undo as the only way back.
  const [importPending, setImportPending] = useState<{ zones: SeatingZone[]; summary: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function setZones(next: SeatingZone[]) {
    onChangeView({ seatingZones: next });
  }

  function updateRow(zoneId: string, rowId: string, patch: Partial<SeatingRow>) {
    setZones(
      zones.map((z) => (z.id === zoneId ? { ...z, rows: z.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : z)),
    );
  }

  function addZone() {
    setZones([...zones, { id: makeId('szone'), name: 'New zone', rows: [] }]);
  }

  function removeZone(zoneId: string) {
    setZones(zones.filter((z) => z.id !== zoneId));
  }

  function addRow(zoneId: string) {
    setZones(
      zones.map((z) =>
        z.id === zoneId ? { ...z, rows: [...z.rows, { id: makeId('srow'), label: 'New area', achieved: '0' }] } : z,
      ),
    );
  }

  function removeRow(zoneId: string, rowId: string) {
    setZones(zones.map((z) => (z.id === zoneId ? { ...z, rows: z.rows.filter((r) => r.id !== rowId) } : z)));
  }

  function toggleRowHotspot(zoneId: string, row: SeatingRow, hotspotId: string) {
    const has = row.hotspotIds?.includes(hotspotId);
    const next = has ? (row.hotspotIds ?? []).filter((id) => id !== hotspotId) : [...(row.hotspotIds ?? []), hotspotId];
    updateRow(zoneId, row.id, { hotspotIds: next.length ? next : undefined });
  }

  // Which row (if any) is the source of the current highlight — a direct row
  // hover, or a row that links to the currently-hovered plan hotspot — used
  // to surface that row's contextual note, matching the reference's
  // #pl-notes-live (shown only while relevant, not permanently listed).
  const activeNote = zones
    .flatMap((z) => z.rows)
    .find((r) => r.id === hoveredRowId || (hoveredHotspotId && r.hotspotIds?.includes(hoveredHotspotId)))?.note;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImportBusy(true);
    setImportError(null);
    setImportPending(null);
    try {
      const rows = await parseSeatingWorkbook(file);
      const hotspotIdByLabel = new Map(hotspots.filter((h) => h.label).map((h) => [h.label!.trim().toLowerCase(), h.id]));
      const nextZones: SeatingZone[] = zones.map((z) => ({ ...z, rows: [...z.rows] }));
      const zoneIdxByName = new Map(nextZones.map((z, i) => [z.name.trim().toLowerCase(), i]));
      let added = 0;
      let updated = 0;
      let matched = 0;
      for (const row of rows) {
        const zoneKey = row.zone.trim().toLowerCase();
        let zi = zoneIdxByName.get(zoneKey);
        if (zi == null) {
          zi = nextZones.length;
          nextZones.push({ id: makeId('szone'), name: row.zone, rows: [] });
          zoneIdxByName.set(zoneKey, zi);
        }
        const zone = nextZones[zi];
        const hotspotId = hotspotIdByLabel.get(row.label.trim().toLowerCase());
        if (hotspotId) matched += 1;
        const existingIdx = zone.rows.findIndex((r) => r.label.trim().toLowerCase() === row.label.trim().toLowerCase());
        if (existingIdx >= 0) {
          zone.rows[existingIdx] = {
            ...zone.rows[existingIdx],
            required: row.required,
            achieved: row.achieved,
            hotspotIds: hotspotId ? [hotspotId] : zone.rows[existingIdx].hotspotIds,
          };
          updated += 1;
        } else {
          zone.rows.push({
            id: makeId('srow'),
            label: row.label,
            required: row.required,
            achieved: row.achieved,
            hotspotIds: hotspotId ? [hotspotId] : undefined,
          });
          added += 1;
        }
      }
      setImportPending({
        zones: nextZones,
        summary: `${added} row${added === 1 ? '' : 's'} added, ${updated} updated, ${matched} linked to a hotspot.`,
      });
    } catch (err) {
      console.error('Could not read that spreadsheet:', err);
      setImportError('Could not read that spreadsheet.');
    } finally {
      setImportBusy(false);
    }
  }

  // Closed goes further than collapsed — no title bar left, just a narrow
  // reopen tab, materially thinner than even the collapsed title bar, so the
  // plan reclaims that much more width (same reflow mechanism: this
  // component's own root claims less, the plan next to it fills the rest).
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        title="Show seating capacity"
        className="flex w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-wide">Seating</span>
      </button>
    );
  }

  // Collapsed drops the fixed width rather than just hiding content below it
  // — the plan sits in a `flex-1 aspect-video` box right next to this one, so
  // freeing the width here lets it actually grow into it (and, via
  // aspect-video, grow taller too), not just leave dead space.
  return (
    <div className={`flex shrink-0 flex-col gap-3 ${collapsed ? 'w-auto' : 'w-72 overflow-y-auto'}`}>
      <div className="flex items-center gap-1.5">
        {/* A sibling button, not a wrapper around the editable title — the
            title is contentEditable, and contentEditable inside a <button>
            is unreliable (a click to place the cursor can fire the button's
            own click instead of focusing the text). */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Show seating capacity' : 'Hide seating capacity'}
          className="shrink-0 text-[9px] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          <span className={`inline-block transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          title="Close seating capacity"
          className="shrink-0 text-[10px] text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
        <EditableText
          editable={editable}
          value={view.seatingTitle ?? ''}
          onChange={(v) => onChangeView({ seatingTitle: v })}
          as="div"
          placeholder="Seating Capacity"
          className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-[var(--ink)] outline-none"
        />
        {editable && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importBusy}
              title="Import zones/rows from Excel"
              className="shrink-0 rounded-md border border-dashed border-[var(--line)] px-2 py-1 text-[10px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {importBusy ? '…' : '⬆ Excel'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute h-px w-px overflow-hidden opacity-0"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void handleFile(file);
              }}
            />
          </>
        )}
      </div>

      {importError && <p className="text-[10px] text-red-500">{importError}</p>}
      {importPending && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--accent-soft)] px-2.5 py-2 text-[10px] text-[var(--ink-2)]">
          <p className="mb-1.5">{importPending.summary}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setZones(importPending.zones);
                setImportPending(null);
              }}
              className="rounded-md bg-[var(--accent)] px-2 py-1 text-[10px] font-semibold text-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setImportPending(null)}
              className="rounded-md border border-[var(--line)] px-2 py-1 text-[10px] font-medium text-[var(--ink-3)] hover:border-[var(--ink-3)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!collapsed && (!editable && zones.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_44px_44px] gap-2 border-b border-[var(--line)] pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            <span>Area</span>
            <span className="text-right">Req.</span>
            <span className="text-right">Achv.</span>
          </div>
          {zones.map((zone) => (
            <div key={zone.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <EditableText
                  editable={editable}
                  value={zone.name}
                  onChange={(v) => setZones(zones.map((z) => (z.id === zone.id ? { ...z, name: v } : z)))}
                  as="div"
                  placeholder="Zone"
                  className="font-display text-[11px] font-bold text-[var(--ink)] outline-none"
                />
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeZone(zone.id)}
                    className="text-[9px] font-semibold text-[var(--ink-3)] hover:text-red-500"
                  >
                    Remove zone
                  </button>
                )}
              </div>
              {zone.rows.map((row) => {
                const highlighted =
                  hoveredRowId === row.id || (!!hoveredHotspotId && !!row.hotspotIds?.includes(hoveredHotspotId));
                const soleHotspotId = row.hotspotIds?.length === 1 ? row.hotspotIds[0] : undefined;
                const clickable = !editable && !!soleHotspotId && !!onSelectHotspot;
                return (
                  <div key={row.id} className="flex flex-col">
                    <div
                      onMouseEnter={() => {
                        setHoveredRowId(row.id);
                        onHoverHotspots(row.hotspotIds ?? []);
                      }}
                      onMouseLeave={() => {
                        setHoveredRowId(null);
                        onHoverHotspots([]);
                      }}
                      onClick={clickable ? () => onSelectHotspot!(soleHotspotId!) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelectHotspot!(soleHotspotId!);
                              }
                            }
                          : undefined
                      }
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      className={`grid grid-cols-[1fr_44px_44px] items-baseline gap-2 rounded px-1.5 py-1 text-[11px] transition-colors ${
                        highlighted ? 'bg-[var(--accent-soft)]' : ''
                      } ${row.kind === 'group' ? 'mt-1 border-t border-[var(--line)] pt-1.5 font-semibold text-[var(--ink)]' : ''} ${
                        row.kind === 'sub' ? 'pl-3 text-[var(--ink-3)]' : 'text-[var(--ink-2)]'
                      } ${clickable ? 'cursor-pointer' : ''}`}
                    >
                      {editable ? (
                        <EditableText
                          editable
                          value={row.label}
                          onChange={(v) => updateRow(zone.id, row.id, { label: v })}
                          as="span"
                          placeholder="Area"
                          className="outline-none"
                        />
                      ) : (
                        <span className="truncate">{row.label}</span>
                      )}
                      {editable ? (
                        <input
                          value={row.required ?? ''}
                          onChange={(e) => updateRow(zone.id, row.id, { required: e.target.value || undefined })}
                          placeholder="—"
                          className="w-full rounded border border-[var(--line)] px-1 py-0.5 text-right text-[10px] outline-none"
                        />
                      ) : (
                        <span className="text-right tabular-nums text-[var(--ink-3)]">{row.required || '—'}</span>
                      )}
                      {editable ? (
                        <input
                          value={row.achieved}
                          onChange={(e) => updateRow(zone.id, row.id, { achieved: e.target.value })}
                          className="w-full rounded border border-[var(--line)] px-1 py-0.5 text-right text-[10px] font-semibold outline-none"
                        />
                      ) : (
                        <span className="text-right font-semibold tabular-nums">{row.achieved}</span>
                      )}
                    </div>
                    {editable && (
                      <div className="mb-1 flex flex-wrap items-center gap-1 pl-1.5">
                        <select
                          value={row.kind ?? 'row'}
                          onChange={(e) => updateRow(zone.id, row.id, { kind: e.target.value as SeatingRow['kind'] })}
                          className="rounded border border-[var(--line)] px-1 py-0.5 text-[9px] outline-none"
                        >
                          <option value="row">Row</option>
                          <option value="group">Group header</option>
                          <option value="sub">Sub-row</option>
                        </select>
                        {hotspots.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => toggleRowHotspot(zone.id, row, h.id)}
                            title="Link this row to this hotspot for two-way hover"
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium transition ${
                              row.hotspotIds?.includes(h.id)
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                            }`}
                          >
                            {h.label || 'Untitled'}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => removeRow(zone.id, row.id)}
                          className="ml-auto text-[9px] font-semibold text-[var(--ink-3)] hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {editable && (
                <button
                  type="button"
                  onClick={() => addRow(zone.id)}
                  className="self-start rounded-md border border-dashed border-[var(--line)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + Row
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button
              type="button"
              onClick={addZone}
              className="self-start rounded-md border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              + Zone
            </button>
          )}
        </div>
      ))}

      {!collapsed && activeNote && (
        <div className="rounded-md border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-2.5 py-2 text-[11px] leading-snug text-[var(--ink-2)]">
          {activeNote}
        </div>
      )}
    </div>
  );
}
