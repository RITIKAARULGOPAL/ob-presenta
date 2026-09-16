'use client';

import { useEffect, useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { parseOccupancyWorkbook } from '@/lib/importExcel';
import type { OccupancyZone, Slide } from '@/types/slide';

/** One bar's fill fraction (0–1) and the label shown above it — value/capacity
 *  when a capacity is set (a real percentage-of-capacity reading), otherwise
 *  value scaled against the slide's own max so bars stay comparative. */
function barFraction(zone: OccupancyZone, maxValue: number): { fraction: number; overCapacity: boolean } {
  if (zone.capacity != null && zone.capacity > 0) {
    return { fraction: Math.min(1, zone.value / zone.capacity), overCapacity: zone.value > zone.capacity };
  }
  return { fraction: maxValue > 0 ? Math.min(1, zone.value / maxValue) : 0, overCapacity: false };
}

function Bar({
  zone,
  maxValue,
  unit,
  editable,
  hovered,
  focused,
  onHover,
  onChange,
  onRemove,
}: {
  zone: OccupancyZone;
  maxValue: number;
  unit: string;
  editable: boolean;
  hovered: boolean;
  focused: boolean;
  onHover: (id: string | null) => void;
  onChange: (patch: Partial<OccupancyZone>) => void;
  onRemove: () => void;
}) {
  const { fraction, overCapacity } = barFraction(zone, maxValue);
  const highlighted = hovered || focused;

  return (
    <div
      className="group/zone flex flex-1 flex-col items-center gap-2"
      onMouseEnter={() => onHover(zone.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="relative flex h-40 w-full items-end justify-center">
        <div
          className={`relative h-full w-10 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-2)] transition-shadow ${
            highlighted ? 'ring-2 ring-[var(--accent)] ring-offset-2' : ''
          }`}
        >
          <div
            className={`absolute bottom-0 left-0 w-full rounded-[var(--radius-sm)] transition-[height] duration-300 ease-out ${
              overCapacity ? 'bg-red-500' : highlighted ? 'bg-[var(--accent)]' : 'bg-[var(--accent-soft-line)]'
            }`}
            style={{ height: `${Math.max(fraction * 100, zone.value > 0 ? 3 : 0)}%` }}
          />
        </div>
        {highlighted && (
          <div className="absolute -top-7 whitespace-nowrap rounded-md bg-[var(--ink)] px-2 py-1 text-[10px] font-semibold text-white shadow-[var(--shadow-sm)]">
            {zone.capacity != null ? `${zone.value} / ${zone.capacity} ${unit}` : `${zone.value} ${unit}`}
          </div>
        )}
      </div>

      {editable ? (
        <>
          <EditableText
            editable
            value={zone.label}
            onChange={(v) => onChange({ label: v })}
            as="div"
            placeholder="Zone"
            className="max-w-[7rem] text-center text-xs font-semibold leading-tight text-[var(--ink)] outline-none"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={zone.value}
              onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
              className="w-14 rounded border border-[var(--line)] px-1.5 py-0.5 text-center text-[11px] outline-none"
            />
            <span className="text-[10px] text-[var(--ink-3)]">/</span>
            <input
              type="number"
              value={zone.capacity ?? ''}
              placeholder="cap."
              onChange={(e) => onChange({ capacity: e.target.value ? Number(e.target.value) : undefined })}
              className="w-14 rounded border border-[var(--line)] px-1.5 py-0.5 text-center text-[11px] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-[9px] font-semibold text-[var(--ink-3)] opacity-0 hover:text-red-500 group-hover/zone:opacity-100"
          >
            Remove
          </button>
        </>
      ) : (
        <div className="max-w-[7rem] text-center text-xs font-semibold leading-tight text-[var(--ink)]">{zone.label}</div>
      )}
    </div>
  );
}

/** A bar-per-zone occupancy chart. Custom SVG-free bar rendering (plain
 *  divs, since bars are simple rects with no shared coordinate space to
 *  justify an SVG viewBox) — reads/writes `slide.fields.occupancyZones`
 *  through the same add/remove-by-id + updateField pattern every other
 *  labeled-array field in this codebase already follows (see OrbitDiagram). */
export function OccupancyChart({ slide, editable }: { slide: Slide; editable: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  const addOccupancyZone = useEditorStore((s) => s.addOccupancyZone);
  const removeOccupancyZone = useEditorStore((s) => s.removeOccupancyZone);
  const importOccupancyData = useEditorStore((s) => s.importOccupancyData);
  const project = useEditorStore((s) => s.project);
  const focusZoneId = useEditorStore((s) => s.focusZoneId);
  const setFocusZoneId = useEditorStore((s) => s.setFocusZoneId);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [pickLinkedSlide, setPickLinkedSlide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRowsRef = useRef<{ label: string; value: number; capacity?: number }[] | null>(null);

  const zones = slide.fields.occupancyZones ?? [];
  const unit = slide.fields.occupancyUnit?.trim() || 'occupants';
  const maxValue = Math.max(1, ...zones.map((z) => z.value));

  // Clear the transient "arrived via hotspot click" highlight after it's
  // had a moment to actually be seen. A microtask here would clear it
  // before the browser ever paints the highlighted frame — microtasks flush
  // before paint, so the bar would highlight and un-highlight within the
  // same frame, invisibly. A short real delay is what makes this land as a
  // noticeable "arrived here" cue instead of a no-op.
  useEffect(() => {
    if (!focusZoneId) return;
    const timer = setTimeout(() => setFocusZoneId(null), 2200);
    return () => clearTimeout(timer);
  }, [focusZoneId, setFocusZoneId]);

  function setZone(id: string, patch: Partial<OccupancyZone>) {
    updateField('occupancyZones', zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  const linkedViewsSlides = (project?.slides ?? []).filter((s) => s.layout === 'linked-views');

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImportBusy(true);
    setImportSummary(null);
    try {
      const rows = await parseOccupancyWorkbook(file);
      if (!slide.fields.linkedViewSlideId && linkedViewsSlides.length > 0) {
        pendingRowsRef.current = rows;
        setPickLinkedSlide(true);
        return;
      }
      runImport(rows, slide.fields.linkedViewSlideId);
    } catch (err) {
      console.error('Could not read that spreadsheet:', err);
      setImportSummary('Could not read that spreadsheet.');
    } finally {
      setImportBusy(false);
    }
  }

  function runImport(rows: { label: string; value: number; capacity?: number }[], linkedViewSlideId?: string) {
    const result = importOccupancyData({ chartSlideId: slide.id, linkedViewSlideId, zones: rows });
    const parts = [`${result.added} zone${result.added === 1 ? '' : 's'} added`];
    if (result.updated) parts.push(`${result.updated} updated`);
    parts.push(`${result.hotspotsUpdated} hotspot${result.hotspotsUpdated === 1 ? '' : 's'} updated`);
    if (result.unmatched.length) parts.push(`${result.unmatched.length} unmatched (${result.unmatched.join(', ')})`);
    setImportSummary(parts.join(', '));
    pendingRowsRef.current = null;
    setPickLinkedSlide(false);
  }

  return (
    <div className="mt-6">
      {editable && (
        <div className="relative mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-3)]">
            Unit
            <input
              value={slide.fields.occupancyUnit ?? ''}
              onChange={(e) => updateField('occupancyUnit', e.target.value)}
              placeholder="occupants"
              className="w-28 rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importBusy}
            className="rounded-md border border-dashed border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            {importBusy ? 'Importing…' : '⬆ Import from Excel'}
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
        </div>
      )}

      {pickLinkedSlide && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs">
          <span className="font-medium text-[var(--ink-2)]">Link zones to hotspots on:</span>
          <select
            className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs outline-none"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id || !pendingRowsRef.current) return;
              updateField('linkedViewSlideId', id);
              runImport(pendingRowsRef.current, id);
            }}
          >
            <option value="" disabled>
              Choose a slide…
            </option>
            {linkedViewsSlides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fields.title || 'Untitled slide'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (pendingRowsRef.current) runImport(pendingRowsRef.current, undefined);
            }}
            className="text-[var(--ink-3)] underline"
          >
            Skip linking
          </button>
        </div>
      )}

      {importSummary && <p className="mb-3 text-[11px] text-[var(--ink-3)]">{importSummary}</p>}

      {zones.length === 0 && !editable ? null : (
        <div className="flex items-end gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
          {zones.map((zone) => (
            <Bar
              key={zone.id}
              zone={zone}
              maxValue={maxValue}
              unit={unit}
              editable={editable}
              hovered={hoveredZoneId === zone.id}
              focused={focusZoneId === zone.id}
              onHover={setHoveredZoneId}
              onChange={(patch) => setZone(zone.id, patch)}
              onRemove={() => removeOccupancyZone(zone.id)}
            />
          ))}
          {editable && (
            <button
              type="button"
              onClick={addOccupancyZone}
              className="mb-1 flex h-40 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] text-lg text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
}
