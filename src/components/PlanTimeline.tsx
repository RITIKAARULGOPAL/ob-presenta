'use client';

import { useState } from 'react';
import { StageActions, StagePicker } from './StageEditing';

export interface PlanTimelineStage {
  id: string;
  label: string;
}

interface PlanTimelineProps {
  /** 'timeline' is the plan-evolution stepper, for Layout views. 'pills' is
   *  a plain row of stage pills, for Render and Axo views, which use stages
   *  for things like day and night where a progress bar would misrepresent
   *  what switching means. */
  variant: 'timeline' | 'pills';
  stages: PlanTimelineStage[];
  activeStageId: string | undefined;
  editable: boolean;
  onSelect: (stageId: string) => void;
  onAddStages: (labels: string[]) => void;
  onRenameStage: (stageId: string, label: string) => void;
  onMoveStage: (stageId: string, delta: -1 | 1) => void;
  onRequestDeleteStage: (stageId: string) => void;
  /** Called as the add-stages picker opens, so a half-drawn shape can't
   *  swallow the keys typed into it. */
  onOpenPicker?: () => void;
}

/** A Linked View's stage switcher, drawn on the slide. The timeline variant
 *  is the Sidvin-style stepper: a thin track with a fill bar and a row of
 *  dot-and-label markers, where reaching a stage *is* switching to it.
 *
 *  While editing, the selected stage gets move-earlier, move-later and
 *  delete controls under its marker (or beside its pill), a double-click
 *  renames any stage, and "+ Stage" opens the picker. The Properties
 *  panel's Stages list offers the same actions; both call the same
 *  handlers. */
export default function PlanTimeline({
  variant,
  stages,
  activeStageId,
  editable,
  onSelect,
  onAddStages,
  onRenameStage,
  onMoveStage,
  onRequestDeleteStage,
  onOpenPicker,
}: PlanTimelineProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const found = stages.findIndex((s) => s.id === activeStageId);
  const activeIndex = Math.max(0, found);
  const fillPct = stages.length > 1 ? (activeIndex / (stages.length - 1)) * 100 : 0;

  function commitRename() {
    if (renamingId && draft.trim()) onRenameStage(renamingId, draft.trim());
    setRenamingId(null);
  }
  function startRename(s: PlanTimelineStage) {
    if (!editable) return;
    setRenamingId(s.id);
    setDraft(s.label);
  }
  function togglePicker() {
    if (!pickerOpen) onOpenPicker?.();
    setPickerOpen((o) => !o);
  }

  const renameInput = (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenamingId(null);
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label="Stage name"
      className="w-24 rounded border border-[var(--accent)] px-1 text-center text-[11px] text-[var(--ink)] outline-none"
    />
  );

  const addButton = editable && (
    <button
      type="button"
      onClick={togglePicker}
      aria-expanded={pickerOpen}
      className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {stages.length ? '+ Stage' : '+ Add stages'}
    </button>
  );

  const picker = pickerOpen && (
    <StagePicker
      surface="slide"
      suggest={variant === 'timeline'}
      existingLabels={stages.map((s) => s.label)}
      onAdd={(labels) => {
        onAddStages(labels);
        setPickerOpen(false);
      }}
      onCancel={() => setPickerOpen(false)}
    />
  );

  const actionsFor = (s: PlanTimelineStage, i: number) =>
    editable &&
    i === activeIndex && (
      <StageActions
        label={s.label}
        canEarlier={i > 0}
        canLater={i < stages.length - 1}
        onMove={(delta) => onMoveStage(s.id, delta)}
        onDelete={() => onRequestDeleteStage(s.id)}
      />
    );

  if (!stages.length) {
    return editable ? (
      <div>
        {addButton}
        {picker}
      </div>
    ) : null;
  }

  if (variant === 'pills') {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-0.5">
              {renamingId === s.id ? (
                renameInput
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  onDoubleClick={() => startRename(s)}
                  title={editable ? 'Double-click to rename' : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    i === activeIndex
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                  }`}
                >
                  {s.label}
                </button>
              )}
              {actionsFor(s, i)}
            </div>
          ))}
          {addButton}
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div className="relative w-full pt-1">
      <div className="pointer-events-none absolute left-[14px] right-[14px] top-[19px] h-[2px] rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out" style={{ width: `${fillPct}%` }} />
      </div>
      <div className="relative flex items-start justify-between gap-1">
        {stages.map((s, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming';
          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(s);
                }}
                className="flex flex-col items-center gap-1.5 bg-transparent px-1"
                title={editable ? 'Double-click to rename' : undefined}
              >
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    state === 'active'
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : state === 'done'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-transparent'
                  }`}
                />
                {renamingId !== s.id && (
                  <span className={`whitespace-nowrap text-[11px] font-semibold ${state === 'upcoming' ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]'}`}>
                    {s.label}
                  </span>
                )}
              </button>
              {/* Outside the marker button: an input inside a button is
                  invalid, and its clicks would select the stage too. */}
              {renamingId === s.id && renameInput}
              {actionsFor(s, i)}
            </div>
          );
        })}
      </div>
      {editable && <div className="mt-1.5">{addButton}</div>}
      {picker}
    </div>
  );
}
