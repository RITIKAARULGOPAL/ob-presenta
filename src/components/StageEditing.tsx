'use client';

import { useState } from 'react';
import { SUGGESTED_PLAN_STAGES } from '@/lib/linkedViewStages';
import type { LinkedViewStagesSnapshot } from '@/lib/editorStore';
import { IconButton } from './ui/Button';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconClose, IconTrash } from './icons';

// Stage editing controls, used in two places at the user's request: on the
// slide, next to the stage timeline or pills (PlanTimeline), and in the
// Properties panel's Linked View Tools (StageList). Both call the same
// handlers in LinkedViewsExplorer. The slide copies paint from the slide's
// own --ink/--line/--accent scope, since they sit inside the slide; the panel
// copies use the chrome's ui tokens.

type Surface = 'slide' | 'panel';

const SURFACE: Record<Surface, { box: string; heading: string; chip: string; chipOn: string; chipAdded: string; input: string; ghost: string; primary: string }> = {
  slide: {
    box: 'mt-2 flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-white p-2.5 text-[var(--ink)] shadow-sm',
    heading: 'text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]',
    chip: 'border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]',
    chipOn: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',
    chipAdded: 'border-[var(--line)] text-[var(--ink-3)] opacity-60',
    input: 'rounded-md border border-[var(--line)] px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]',
    ghost: 'rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)]',
    primary: 'rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40',
  },
  panel: {
    box: 'mt-2 flex flex-col gap-2 rounded-ui-md border border-ui-line bg-ui-raised p-2.5',
    heading: 'text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3',
    chip: 'border-ui-line text-ui-ink-2 hover:border-ui-line-strong',
    chipOn: 'border-ui-accent-line bg-ui-accent-soft text-ui-accent',
    chipAdded: 'border-ui-line text-ui-ink-3 opacity-60',
    input: 'rounded-ui-sm border border-ui-line bg-ui-surface px-2 py-1 text-[12px] text-ui-ink outline-none',
    ghost: 'rounded-ui-sm px-2.5 py-1 text-[12px] font-medium text-ui-ink-3 hover:text-ui-ink',
    primary: 'rounded-ui-sm bg-ui-accent px-3 py-1 text-[12px] font-semibold text-ui-accent-on disabled:opacity-40',
  },
};

const norm = (label: string) => label.trim().toLowerCase();

/** Pick stages to add: the six suggested plan stages to tick (Layout views
 *  only), and a stage with any name. One Add for all of them, so building a
 *  plan's whole progression is one action and one Undo. */
export function StagePicker({
  surface,
  suggest,
  existingLabels,
  onAdd,
  onCancel,
}: {
  surface: Surface;
  suggest: boolean;
  existingLabels: string[];
  onAdd: (labels: string[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const s = SURFACE[surface];
  const has = (label: string) => existingLabels.some((l) => norm(l) === norm(label));
  // Suggested stages go in the order they're presented, whatever order they
  // were ticked in; addStages then slots each one into place.
  const labels = [...SUGGESTED_PLAN_STAGES.filter((l) => picked.includes(l)), ...(custom.trim() ? [custom.trim()] : [])];

  function toggle(label: string) {
    setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
  }

  return (
    <div className={s.box}>
      {suggest && (
        <>
          <div className={s.heading}>Suggested stages</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PLAN_STAGES.map((label) => {
              const added = has(label);
              const on = picked.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={added}
                  aria-pressed={added || on}
                  onClick={() => toggle(label)}
                  title={added ? 'Already on this plan' : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${added ? s.chipAdded : on ? s.chipOn : s.chip}`}
                >
                  {added || on ? '✓ ' : ''}
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && labels.length) onAdd(labels);
          if (e.key === 'Escape') onCancel();
        }}
        aria-label="Stage name"
        placeholder={suggest ? 'Or name a stage of your own' : 'Stage name, e.g. Night'}
        className={s.input}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={s.ghost}>
          Cancel
        </button>
        <button type="button" disabled={!labels.length} onClick={() => onAdd(labels)} className={s.primary}>
          {labels.length > 1 ? `Add ${labels.length} stages` : 'Add stage'}
        </button>
      </div>
    </div>
  );
}

/** Move earlier, move later and delete, for the selected stage, drawn on the
 *  slide beside its marker or pill. */
export function StageActions({
  label,
  canEarlier,
  canLater,
  onMove,
  onDelete,
}: {
  label: string;
  canEarlier: boolean;
  canLater: boolean;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const btn = 'flex h-5 w-5 items-center justify-center rounded-full text-[var(--ink-3)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" aria-label={`Move ${label} earlier`} title="Move earlier" disabled={!canEarlier} onClick={() => onMove(-1)} className={btn}>
        <IconChevronLeft className="h-3 w-3" />
      </button>
      <button type="button" aria-label={`Move ${label} later`} title="Move later" disabled={!canLater} onClick={() => onMove(1)} className={btn}>
        <IconChevronRight className="h-3 w-3" />
      </button>
      <button type="button" aria-label={`Delete ${label}`} title="Delete stage" onClick={onDelete} className={`${btn} hover:text-red-600`}>
        <IconClose className="h-3 w-3" />
      </button>
    </div>
  );
}

/** The Stages list in the Properties panel: every stage in order, each
 *  renamable in place, movable up and down, and deletable, plus the same
 *  add-stages picker as the slide. */
export function StageList({ stages }: { stages: LinkedViewStagesSnapshot }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3">Stages</div>
      {stages.list.length === 0 && !adding && (
        <p className="mb-2 text-[11px] leading-snug text-ui-ink-3">
          None yet. Without stages the plan is one image; with them, each stage can bring its own.
        </p>
      )}
      {stages.list.length > 0 && (
        <ol className="flex flex-col gap-1">
          {stages.list.map((stage, i) => (
            <StageRow
              key={stage.id}
              label={stage.label}
              index={i}
              count={stages.list.length}
              active={stage.id === stages.activeStageId}
              onSelect={() => stages.onSelect(stage.id)}
              onRename={(label) => stages.onRename(stage.id, label)}
              onMove={(delta) => stages.onMove(stage.id, delta)}
              onDelete={() => stages.onRequestDelete(stage.id)}
            />
          ))}
        </ol>
      )}
      {adding ? (
        <StagePicker
          surface="panel"
          suggest={stages.suggest}
          existingLabels={stages.list.map((s) => s.label)}
          onAdd={(labels) => {
            stages.onAdd(labels);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 rounded-ui-sm border border-dashed border-ui-line px-2.5 py-1 text-[12px] font-medium text-ui-ink-3 transition hover:border-ui-accent hover:text-ui-accent"
        >
          + Add stages
        </button>
      )}
    </div>
  );
}

function StageRow({
  label,
  index,
  count,
  active,
  onSelect,
  onRename,
  onMove,
  onDelete,
}: {
  label: string;
  index: number;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename: (label: string) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(label);
  // A rename made on the slide's timeline, or an Undo, changes the label
  // underneath this box; follow it.
  const [seen, setSeen] = useState(label);
  if (seen !== label) {
    setSeen(label);
    setDraft(label);
  }

  function commit() {
    if (draft.trim() && draft.trim() !== label) onRename(draft);
    else setDraft(label);
  }

  return (
    <li className={`flex items-center gap-1 rounded-ui-sm border py-0.5 pl-1 pr-0.5 ${active ? 'border-ui-accent-line bg-ui-accent-soft' : 'border-ui-line'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Show ${label} on the slide`}
        title="Show this stage on the slide"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${active ? 'bg-ui-accent text-ui-accent-on' : 'text-ui-ink-3 hover:bg-ui-raised'}`}
      >
        {index + 1}
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(label);
            e.currentTarget.blur();
          }
        }}
        aria-label={`Name of stage ${index + 1}`}
        className="min-w-0 flex-1 bg-transparent px-1 text-[12px] font-medium text-ui-ink outline-none"
      />
      <IconButton size="sm" label={`Move ${label} up`} icon={<IconChevronUp className="h-3.5 w-3.5" />} disabled={index === 0} onClick={() => onMove(-1)} />
      <IconButton size="sm" label={`Move ${label} down`} icon={<IconChevronDown className="h-3.5 w-3.5" />} disabled={index === count - 1} onClick={() => onMove(1)} />
      <IconButton size="sm" variant="danger" label={`Delete ${label}`} icon={<IconTrash className="h-3.5 w-3.5" />} onClick={onDelete} />
    </li>
  );
}
