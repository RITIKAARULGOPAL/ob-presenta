'use client';

import { useEffect, useRef, useState } from 'react';
import { EMPTY_SITE_UI, useEditorStore, type SitePlacement, type SiteToolsSnapshot } from '@/lib/editorStore';
import {
  addSiteFact,
  removeSiteAnalysis,
  removeSiteEntry,
  removeSiteFact,
  setUpSiteAnalysis,
  updateSiteEntry,
  updateSiteFact,
} from '@/lib/siteAnalysis';
import { codeFromLabel, PLAN_ITEMS, PLAN_LAYERS, SITE_CATEGORIES, SITE_ITEMS, SITE_STATUSES, siteCategory, siteItem, siteStatus, type SiteItemDef } from '@/lib/siteChecklist';
import { makeId } from '@/lib/id';
import { LINKED_VIEW_DRAW_TOOLS } from './SlideRenderer';
import { Button, IconButton } from './ui/Button';
import { IconChevronDown, IconChevronRight, IconClose, IconEye, IconEyeOff, IconTrash } from './icons';
import type { LinkedView, PlanAnnotation, PlanLineStyle, Project, SiteCategoryKey, SiteFact, SiteStatus } from '@/types/slide';

// The Properties panel's Site Analysis section (S2): set up, layers, what to
// place on the plan, the checklist rows, and the fields of whatever's
// selected on the slide, at full size (decision 3). It reads the entries and
// rows from the deck itself and the tools' state from the store's `siteUi`,
// and writes through updateLinkedView with explicit ids, so nothing here can
// act on an old copy of the stage.

const HEADING = 'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3';
const FIELD = 'w-full rounded-ui-sm border border-ui-line bg-ui-surface px-2 py-1 text-[12px] text-ui-ink outline-none focus:border-ui-accent-line';
const CHECKLIST_ORDER = SITE_ITEMS.map((i) => i.key);

const LINE_STYLES: { key: PlanLineStyle; label: string }[] = [
  { key: 'route', label: 'Route, with arrows' },
  { key: 'dashed', label: 'Dashed' },
  { key: 'wall', label: 'Wall' },
  { key: 'grid', label: 'Grid line, with its label' },
];

const KIND_LABEL = { marker: 'Marker', line: 'Line', area: 'Area' } as const;

function findStage(project: Project | null, site: SiteToolsSnapshot) {
  return project?.slides
    .find((s) => s.id === site.slideId)
    ?.fields.views?.find((v) => v.id === site.viewId)
    ?.stages?.find((s) => s.id === site.stageId);
}

export function SitePanel({ site }: { site: SiteToolsSnapshot }) {
  const stage = useEditorStore((s) => findStage(s.project, site));
  const siteUi = useEditorStore((s) => s.siteUi);
  const setSiteUi = useEditorStore((s) => s.setSiteUi);
  const updateLinkedView = useEditorStore((s) => s.updateLinkedView);
  const ui = siteUi.scope === `${site.slideId}/${site.viewId}/${site.stageId}` ? siteUi : EMPTY_SITE_UI;
  const edit = (update: (view: LinkedView) => LinkedView) => updateLinkedView(site.slideId, site.viewId, update);

  if (!site.ready) {
    return (
      <div>
        <p className="mb-2 text-[11px] leading-snug text-ui-ink-3">
          Make this the plan&apos;s Site analysis stage: place lifts, shafts, fire exits and the rest of the checklist on the plan, with the
          site&apos;s facts in a checklist beside it.
        </p>
        <Button variant="raised" size="sm" onClick={() => edit((v) => setUpSiteAnalysis(v, site.stageId))}>
          Set up site analysis
        </Button>
      </div>
    );
  }

  const analysis = stage?.siteAnalysis;
  if (!analysis) return null;
  const entries = analysis.entries;
  const selectedEntry = ui.selected?.kind === 'entry' ? entries.find((e) => e.id === ui.selected?.id) : undefined;
  const selectedFact = ui.selected?.kind === 'fact' ? analysis.facts.find((f) => f.id === ui.selected?.id) : undefined;
  const deselect = () => setSiteUi({ selected: null });

  return (
    <div className="flex flex-col gap-5">
      {selectedEntry && (
        <EntryEditor
          key={selectedEntry.id}
          entry={selectedEntry}
          onChange={(patch) => edit((v) => updateSiteEntry(v, site.stageId, selectedEntry.id, patch))}
          onDelete={() => {
            edit((v) => removeSiteEntry(v, site.stageId, selectedEntry.id));
            deselect();
          }}
          onClose={deselect}
        />
      )}
      {selectedFact && (
        <FactEditor
          key={selectedFact.id}
          fact={selectedFact}
          onChange={(patch) => edit((v) => updateSiteFact(v, site.stageId, selectedFact.id, patch))}
          onRemove={() => {
            edit((v) => removeSiteFact(v, site.stageId, selectedFact.id));
            deselect();
          }}
          onClose={deselect}
        />
      )}

      <LayerList
        entries={entries}
        hidden={ui.hidden}
        onToggle={(key) => setSiteUi({ hidden: ui.hidden.includes(key) ? ui.hidden.filter((k) => k !== key) : [...ui.hidden, key] })}
      />

      <ItemPicker entries={entries} placing={ui.placing} onPlace={site.onPlace} />

      <ChecklistRows
        facts={analysis.facts}
        onAdd={(row) => {
          edit((v) => addSiteFact(v, site.stageId, row, CHECKLIST_ORDER));
          setSiteUi({ selected: { kind: 'fact', id: row.id } });
        }}
      />

      <RemoveSiteAnalysis
        entryCount={entries.length}
        rowCount={analysis.facts.length}
        onRemove={() => {
          site.onPlace(null);
          edit((v) => removeSiteAnalysis(v, site.stageId));
        }}
      />
    </div>
  );
}

/** A text box that edits a draft and commits it on blur or Enter, or if it's
 *  unmounted mid-edit (the selection moved on). Committing through the
 *  caller's own ids is what keeps a late blur from writing into the wrong
 *  entry, and one commit per edit keeps typing off the Undo history. Esc
 *  puts the saved text back. */
function DraftField({
  value,
  onCommit,
  placeholder,
  multiline = false,
  maxLength,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  // An Undo, or an edit made elsewhere, changes the saved text underneath.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const latest = useRef({ draft, value, onCommit });
  useEffect(() => {
    latest.current = { draft, value, onCommit };
  });
  const skipNextCommit = useRef(false);
  useEffect(
    () => () => {
      const { draft: d, value: v, onCommit: commit } = latest.current;
      if (d !== v) commit(d);
    },
    [],
  );

  function commit() {
    if (skipNextCommit.current) {
      skipNextCommit.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  }
  function revert(el: HTMLElement) {
    skipNextCommit.current = true;
    setDraft(value);
    latest.current = { ...latest.current, draft: value };
    el.blur();
  }

  return multiline ? (
    <textarea
      value={draft}
      rows={3}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') revert(e.currentTarget);
      }}
      className={`${FIELD} resize-y leading-snug`}
    />
  ) : (
    <input
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') revert(e.currentTarget);
      }}
      className={FIELD}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3">{label}</span>
      {children}
    </label>
  );
}

function StatusSelect({ value, onChange }: { value: SiteStatus | undefined; onChange: (status: SiteStatus | undefined) => void }) {
  const status = siteStatus(value);
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status ? '' : 'border border-ui-ink-3'}`}
        style={status ? { backgroundColor: status.color } : undefined}
      />
      <select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as SiteStatus | undefined)} className={FIELD}>
        <option value="">Not checked yet</option>
        {SITE_STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** A small panel of fields for what's selected on the slide. Scrolled into
 *  view when it appears, since the panel above it can be long. */
function SelectedBox({ title, dot, onClose, children }: { title: string; dot: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <section ref={ref} className="flex flex-col gap-2.5 rounded-ui-md border border-ui-accent-line bg-ui-raised p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3">{title}</span>
        <IconButton size="sm" label="Done" icon={<IconClose className="h-3.5 w-3.5" />} onClick={onClose} />
      </div>
      {children}
    </section>
  );
}

function EntryEditor({
  entry,
  onChange,
  onDelete,
  onClose,
}: {
  entry: PlanAnnotation;
  onChange: (patch: Partial<Omit<PlanAnnotation, 'id'>>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const item = siteItem(entry.itemKey);
  const category = siteCategory(entry.category);
  return (
    <SelectedBox title={`${KIND_LABEL[entry.kind]} · ${category.label}`} dot={category.color} onClose={onClose}>
      <Field label="Name">
        <DraftField label="Name" value={entry.label} onCommit={(v) => onChange({ label: v })} />
      </Field>
      {entry.kind === 'marker' && (
        <Field label="Code on the plan">
          <DraftField label="Code on the plan" value={entry.code ?? ''} maxLength={3} placeholder="Up to 3 letters" onCommit={(v) => onChange({ code: v.toUpperCase() })} />
        </Field>
      )}
      <Field label={entry.lineStyle === 'grid' ? 'Grid label' : 'Value'}>
        <DraftField label="Value" value={entry.value ?? ''} placeholder={item?.valueHint ?? 'Optional'} onCommit={(v) => onChange({ value: v })} />
      </Field>
      <Field label="Status">
        <StatusSelect value={entry.status} onChange={(status) => onChange({ status })} />
      </Field>
      <Field label="Note">
        <DraftField label="Note" multiline value={entry.note ?? ''} placeholder="Optional" onCommit={(v) => onChange({ note: v })} />
      </Field>
      {entry.directionDeg != null && <DirectionField value={entry.directionDeg} onChange={(directionDeg) => onChange({ directionDeg })} />}
      {entry.kind === 'line' && (
        <Field label="Drawn as">
          <select value={entry.lineStyle ?? 'route'} onChange={(e) => onChange({ lineStyle: e.target.value as PlanLineStyle })} className={FIELD}>
            {LINE_STYLES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!entry.itemKey && (
        <Field label="Layer">
          <select value={entry.category} onChange={(e) => onChange({ category: e.target.value as SiteCategoryKey })} className={FIELD}>
            {PLAN_LAYERS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {item && item.label !== entry.label && <p className="text-[11px] text-ui-ink-3">Checklist item: {item.label}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ui-ink-3">{entry.kind === 'marker' ? 'Drag it on the plan to move it.' : 'Delete and redraw to change its shape.'}</span>
        <Button variant="danger" size="sm" icon={<IconTrash className="h-3.5 w-3.5" />} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </SelectedBox>
  );
}

function DirectionField({ value, onChange }: { value: number; onChange: (deg: number) => void }) {
  const turn = (by: number) => onChange((((value + by) % 360) + 360) % 360);
  return (
    <Field label="View direction">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ui-line text-ui-ink-2">
          <span className="block text-[12px] leading-none" style={{ transform: `rotate(${value}deg)` }}>
            ↑
          </span>
        </span>
        <Button variant="raised" size="sm" onClick={() => turn(-15)} aria-label="Turn 15° anticlockwise">
          ↺ 15°
        </Button>
        <Button variant="raised" size="sm" onClick={() => turn(15)} aria-label="Turn 15° clockwise">
          ↻ 15°
        </Button>
        <span className="ml-auto text-[12px] tabular-nums text-ui-ink-2">{Math.round(value)}°</span>
      </span>
    </Field>
  );
}

function FactEditor({
  fact,
  onChange,
  onRemove,
  onClose,
}: {
  fact: SiteFact;
  onChange: (patch: Partial<Omit<SiteFact, 'id'>>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const item = siteItem(fact.itemKey);
  const category = siteCategory(fact.category);
  return (
    <SelectedBox title={`Checklist row · ${category.label}`} dot={category.color} onClose={onClose}>
      <Field label="Name">
        <DraftField label="Name" value={fact.label} onCommit={(v) => onChange({ label: v })} />
      </Field>
      <Field label="Value">
        <DraftField label="Value" value={fact.value ?? ''} placeholder={item?.valueHint ?? 'Optional'} onCommit={(v) => onChange({ value: v })} />
      </Field>
      <Field label="Status">
        <StatusSelect value={fact.status} onChange={(status) => onChange({ status })} />
      </Field>
      <Field label="Note">
        <DraftField label="Note" multiline value={fact.note ?? ''} placeholder="Optional" onCommit={(v) => onChange({ note: v })} />
      </Field>
      <div className="flex justify-end">
        <Button variant="danger" size="sm" icon={<IconTrash className="h-3.5 w-3.5" />} onClick={onRemove}>
          Remove row
        </Button>
      </div>
    </SelectedBox>
  );
}

function LayerList({ entries, hidden, onToggle }: { entries: PlanAnnotation[]; hidden: SiteCategoryKey[]; onToggle: (key: SiteCategoryKey) => void }) {
  return (
    <div>
      <div className={HEADING}>Layers</div>
      <ul className="flex flex-col">
        {PLAN_LAYERS.map((layer) => {
          const count = entries.filter((e) => e.category === layer.key).length;
          const isHidden = hidden.includes(layer.key);
          return (
            <li key={layer.key} className={`flex items-center gap-2 py-0.5 ${isHidden ? 'opacity-50' : ''}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ui-ink-2">{layer.label}</span>
              <span className="text-[11px] tabular-nums text-ui-ink-3">{count}</span>
              <IconButton
                size="sm"
                label={isHidden ? `Show ${layer.label} on the plan` : `Hide ${layer.label} on the plan`}
                icon={isHidden ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                disabled={!count}
                onClick={() => onToggle(layer.key)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function placementFor(item: SiteItemDef): SitePlacement {
  return {
    itemKey: item.key,
    kind: item.kind === 'fact' ? 'marker' : item.kind,
    category: item.category,
    label: item.label,
    code: item.code,
    lineStyle: item.lineStyle,
    direction: item.direction,
    shape: item.kind === 'area' ? 'polygon' : undefined,
  };
}

/** A small picture of how an item is drawn: its marker, a line in its style,
 *  or an area swatch. */
function KindGlyph({ kind, code, lineStyle, color }: { kind: 'marker' | 'line' | 'area'; code?: string; lineStyle?: PlanLineStyle; color: string }) {
  if (kind === 'marker') {
    return (
      <span
        aria-hidden
        className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-white"
        style={{ backgroundColor: color }}
      >
        {code || '•'}
      </span>
    );
  }
  if (kind === 'area') {
    return <span aria-hidden className="h-3.5 w-[18px] shrink-0 rounded-[3px] border" style={{ borderColor: color, backgroundColor: `${color}33` }} />;
  }
  const dash = lineStyle === 'dashed' ? '3 2' : lineStyle === 'grid' ? '5 2 1 2' : undefined;
  return (
    <svg aria-hidden viewBox="0 0 18 10" className="h-2.5 w-[18px] shrink-0">
      <line x1="1" y1="5" x2={lineStyle === 'route' ? 13 : 17} y2="5" stroke={color} strokeWidth={lineStyle === 'wall' ? 3 : 1.6} strokeDasharray={dash} />
      {lineStyle === 'route' && <path d="M12 1.5 L17 5 L12 8.5 Z" fill={color} />}
    </svg>
  );
}

function ItemPicker({ entries, placing, onPlace }: { entries: PlanAnnotation[]; placing: SitePlacement | null; onPlace: (p: SitePlacement | null) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<SiteCategoryKey | null>(null);
  const q = query.trim().toLowerCase();
  const matches = q ? PLAN_ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.code?.toLowerCase() === q) : [];
  const isArmed = (item: SiteItemDef) => placing?.itemKey === item.key;
  const count = (item: SiteItemDef) => entries.filter((e) => e.itemKey === item.key).length;

  const row = (item: SiteItemDef, showLayer = false) => {
    const layer = siteCategory(item.category);
    const armed = isArmed(item);
    const n = count(item);
    return (
      <button
        key={item.key}
        type="button"
        aria-pressed={armed}
        onClick={() => onPlace(armed ? null : placementFor(item))}
        title={armed ? 'Stop placing' : `Place on the plan: ${item.label}`}
        className={`flex w-full items-center gap-2 rounded-ui-sm px-1.5 py-1 text-left text-[12px] transition ${
          armed ? 'bg-ui-accent-soft text-ui-accent' : 'text-ui-ink-2 hover:bg-ui-raised'
        }`}
      >
        <KindGlyph kind={item.kind === 'fact' ? 'marker' : item.kind} code={item.code} lineStyle={item.lineStyle} color={layer.color} />
        <span className="min-w-0 flex-1">
          {item.label}
          {showLayer && <span className="block text-[10px] text-ui-ink-3">{layer.label}</span>}
        </span>
        {n > 0 && <span className="shrink-0 text-[11px] tabular-nums text-ui-ink-3">{n}</span>}
      </button>
    );
  };

  return (
    <div>
      <div className={HEADING}>Place on the plan</div>
      {placing && <Placing placing={placing} onPlace={onPlace} />}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find an item: lift, DB, sprinkler…"
        aria-label="Find a checklist item"
        className={`${FIELD} mb-1.5`}
      />
      {q ? (
        <div className="flex flex-col">
          {matches.length ? matches.map((item) => row(item, true)) : <p className="px-1.5 py-1 text-[11px] text-ui-ink-3">Nothing in the checklist matches.</p>}
        </div>
      ) : (
        <div className="flex flex-col">
          {PLAN_LAYERS.map((layer) => {
            const items = PLAN_ITEMS.filter((i) => i.category === layer.key);
            const isOpen = open === layer.key;
            const placed = entries.filter((e) => e.category === layer.key).length;
            return (
              <div key={layer.key}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : layer.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 rounded-ui-sm px-1 py-1 text-left text-[12px] font-semibold text-ui-ink-2 hover:bg-ui-raised"
                >
                  {isOpen ? <IconChevronDown className="h-3 w-3 shrink-0 text-ui-ink-3" /> : <IconChevronRight className="h-3 w-3 shrink-0 text-ui-ink-3" />}
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                  <span className="min-w-0 flex-1 truncate">{layer.label}</span>
                  <span className="text-[11px] font-normal tabular-nums text-ui-ink-3">
                    {placed ? `${placed} placed` : `${items.length} items`}
                  </span>
                </button>
                {isOpen && (
                  <div className="mb-1 ml-3 flex flex-col border-l border-ui-line-soft pl-1.5">
                    {items.map((item) => row(item))}
                    <OwnItem category={layer.key} onPlace={onPlace} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Placing({ placing, onPlace }: { placing: SitePlacement; onPlace: (p: SitePlacement | null) => void }) {
  const layer = siteCategory(placing.category);
  const hint =
    placing.kind === 'marker'
      ? 'Click the plan to place one. Keep clicking to place more; Esc stops.'
      : placing.kind === 'line'
        ? 'Click each point. Enter, a double-click or Finish ends the line; Shift keeps it to 45°.'
        : 'Draw it on the plan with one of these shapes:';
  return (
    <div className="mb-2 flex flex-col gap-1.5 rounded-ui-md border border-ui-accent-line bg-ui-accent-soft p-2">
      <div className="flex items-center gap-2">
        <KindGlyph kind={placing.kind} code={placing.code} lineStyle={placing.lineStyle} color={layer.color} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ui-ink">{placing.label}</span>
        <Button variant="raised" size="sm" onClick={() => onPlace(null)}>
          Stop
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-ui-ink-2">{hint}</p>
      {placing.kind === 'area' && (
        <div className="flex flex-wrap gap-1">
          {LINKED_VIEW_DRAW_TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onPlace({ ...placing, shape: t.key })}
              title={t.hint}
              aria-pressed={(placing.shape ?? 'polygon') === t.key}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                (placing.shape ?? 'polygon') === t.key ? 'border-ui-accent bg-ui-surface text-ui-accent' : 'border-ui-line text-ui-ink-2 hover:border-ui-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A marker, line or area with a name of your own, on this layer. */
function OwnItem({ category, onPlace }: { category: SiteCategoryKey; onPlace: (p: SitePlacement | null) => void }) {
  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'marker' | 'line' | 'area'>('marker');
  const place = () => {
    const label = name.trim();
    if (!label) return;
    onPlace({
      kind,
      category,
      label,
      code: kind === 'marker' ? codeFromLabel(label) : undefined,
      lineStyle: kind === 'line' ? 'route' : undefined,
      shape: kind === 'area' ? 'polygon' : undefined,
    });
    setOpenForm(false);
    setName('');
  };
  if (!openForm) {
    return (
      <button type="button" onClick={() => setOpenForm(true)} className="rounded-ui-sm px-1.5 py-1 text-left text-[12px] font-medium text-ui-ink-3 hover:text-ui-accent">
        + One of your own
      </button>
    );
  }
  return (
    <div className="my-1 flex flex-col gap-1.5 rounded-ui-md border border-ui-line bg-ui-raised p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') place();
          if (e.key === 'Escape') setOpenForm(false);
        }}
        placeholder="Name, e.g. Gas meter"
        aria-label="Name"
        className={FIELD}
      />
      <div className="flex gap-1">
        {(['marker', 'line', 'area'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`flex-1 rounded-ui-sm border px-2 py-1 text-[11px] font-medium ${kind === k ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-2'}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-1">
        <Button size="sm" onClick={() => setOpenForm(false)}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={!name.trim()} onClick={place}>
          Place
        </Button>
      </div>
    </div>
  );
}

/** The checklist's rows: how many are checked, and adding one back or one of
 *  your own. Rows themselves are edited by clicking them beside the plan. */
function ChecklistRows({ facts, onAdd }: { facts: SiteFact[]; onAdd: (row: SiteFact) => void }) {
  const [choice, setChoice] = useState('');
  const [ownName, setOwnName] = useState('');
  const checked = facts.filter((f) => f.status).length;
  const missing = SITE_ITEMS.filter((i) => i.kind === 'fact' && !facts.some((f) => f.itemKey === i.key));
  const ownCategory = choice.startsWith('own:') ? (choice.slice(4) as SiteCategoryKey) : null;

  function add() {
    if (ownCategory) {
      const label = ownName.trim();
      if (!label) return;
      onAdd({ id: makeId('fact'), category: ownCategory, label });
      setOwnName('');
    } else {
      const item = siteItem(choice);
      if (!item) return;
      onAdd({ id: makeId('fact'), itemKey: item.key, category: item.category, label: item.label });
    }
    setChoice('');
  }

  return (
    <div>
      <div className={HEADING}>Checklist</div>
      <p className="mb-2 text-[11px] leading-snug text-ui-ink-3">
        {checked} of {facts.length} rows checked. Click a row beside the plan to fill it in here.
      </p>
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Add a checklist row" className={FIELD}>
        <option value="">Add a row…</option>
        {SITE_CATEGORIES.map((c) => (
          <optgroup key={c.key} label={c.label}>
            {missing
              .filter((i) => i.category === c.key)
              .map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            <option value={`own:${c.key}`}>A row of your own…</option>
          </optgroup>
        ))}
      </select>
      {choice && (
        <div className="mt-1.5 flex gap-1.5">
          {ownCategory && (
            <input
              autoFocus
              value={ownName}
              onChange={(e) => setOwnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add();
              }}
              placeholder="Row name"
              aria-label="Row name"
              className={FIELD}
            />
          )}
          <Button variant="raised" size="sm" disabled={!!ownCategory && !ownName.trim()} onClick={add}>
            Add row
          </Button>
        </div>
      )}
    </div>
  );
}

function RemoveSiteAnalysis({ entryCount, rowCount, onRemove }: { entryCount: number; rowCount: number; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start text-[11px] font-medium text-ui-ink-3 hover:text-ui-danger">
        Remove site analysis from this stage
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-ui-md border border-ui-line bg-ui-raised p-2.5 text-[11px] leading-snug text-ui-ink-2">
      <p>
        Its {entryCount} {entryCount === 1 ? 'entry' : 'entries'} on the plan and {rowCount} checklist {rowCount === 1 ? 'row' : 'rows'} are deleted, and the stage becomes an
        ordinary one. Undo brings them back.
      </p>
      <div className="flex justify-end gap-1">
        <Button size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setConfirming(false);
            onRemove();
          }}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
