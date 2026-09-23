'use client';

import { useState } from 'react';

export interface PlanTimelineStage {
  id: string;
  label: string;
}

interface PlanTimelineProps {
  stages: PlanTimelineStage[];
  activeStageId: string | undefined;
  editable: boolean;
  onSelect: (stageId: string) => void;
  onAddStage: () => void;
  onRenameStage: (stageId: string, label: string) => void;
}

/** Sidvin-style plan-evolution stepper — a thin progress track + fill bar
 *  plus a row of dot+label markers — replacing the plain stage-pill row for
 *  Layout views specifically (see LinkedViewsExplorer, which keeps the
 *  plain row for every other view kind: Render/Axo also use stages for
 *  non-progression purposes like a day/night toggle, where a linear
 *  progress bar would misrepresent what switching stages means). Reaching a
 *  stage *is* switching to it — there's no separate "confirm" step. */
export default function PlanTimeline({ stages, activeStageId, editable, onSelect, onAddStage, onRenameStage }: PlanTimelineProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const activeIndex = Math.max(0, stages.findIndex((s) => s.id === activeStageId));
  const fillPct = stages.length > 1 ? (activeIndex / (stages.length - 1)) * 100 : 0;

  function commitRename() {
    if (renamingId && draft.trim()) onRenameStage(renamingId, draft.trim());
    setRenamingId(null);
  }

  if (!stages.length) {
    return editable ? (
      <button
        onClick={onAddStage}
        className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        + Add plan-evolution stages
      </button>
    ) : null;
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
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              onDoubleClick={(e) => {
                if (!editable) return;
                e.stopPropagation();
                setRenamingId(s.id);
                setDraft(s.label);
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
              {renamingId === s.id ? (
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
                  className="w-20 rounded border border-[var(--accent)] px-1 text-center text-[11px] outline-none"
                />
              ) : (
                <span className={`whitespace-nowrap text-[11px] font-semibold ${state === 'upcoming' ? 'text-[var(--ink-3)]' : 'text-[var(--ink)]'}`}>
                  {s.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {editable && (
        <button
          onClick={onAddStage}
          className="mt-1.5 rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          + Stage
        </button>
      )}
    </div>
  );
}
