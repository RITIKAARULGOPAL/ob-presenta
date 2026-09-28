'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/Button';
import type { StageRegionFate } from '@/lib/linkedViewStages';

/** Confirms deleting a Linked View stage, and asks what should happen to the
 *  regions drawn only on it: carry them to other stages, or delete them with
 *  it. Carrying is chosen up front, with the neighbouring stage ticked, so
 *  the careless path loses nothing; the person deleting approves either way.
 *
 *  Rendered into document.body rather than inside the slide. The slide sits
 *  in a scaled stage, which would shrink the dialog and trap its position.
 *  It's editor chrome, so it uses the ui tokens, not the slide's. */
export function StageDeleteDialog({
  stageLabel,
  ownImage,
  imageKept,
  onlyRegions,
  otherStages,
  defaultCarryTo,
  onCancel,
  onConfirm,
}: {
  stageLabel: string;
  /** The stage has a plan image of its own. */
  ownImage: boolean;
  /** That image survives as the plan's own (it's the last stage, and the
   *  plan had no image of its own). */
  imageKept: boolean;
  onlyRegions: number;
  otherStages: { id: string; label: string }[];
  defaultCarryTo: string[];
  onCancel: () => void;
  onConfirm: (fate: StageRegionFate) => void;
}) {
  const [mode, setMode] = useState<'carry' | 'delete'>('carry');
  const [carryTo, setCarryTo] = useState<string[]>(defaultCarryTo);
  const keepOnPlan = otherStages.length === 0;
  const canConfirm = onlyRegions === 0 || mode === 'delete' || keepOnPlan || carryTo.length > 0;

  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Every key belongs to this dialog while it's open. Otherwise Delete or
      // Backspace with one of its buttons focused would reach the editor's
      // own shortcut and delete the whole slide. Stopping the event here
      // doesn't block the browser's own handling: Tab, Space and Enter still
      // work on the dialog's controls.
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const regionsText = onlyRegions === 1 ? '1 region is' : `${onlyRegions} regions are`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stage-delete-title"
        aria-describedby="stage-delete-body"
        className="w-full max-w-sm rounded-ui-lg border border-ui-line bg-ui-surface p-5 shadow-modal"
      >
        <h2 id="stage-delete-title" className="text-body font-semibold text-ui-ink">
          Delete the “{stageLabel}” stage?
        </h2>
        <div id="stage-delete-body" className="mt-2 flex flex-col gap-3 text-ctl text-ui-ink-2">
          {ownImage && (
            <p>
              {imageKept
                ? 'Its plan image stays, as the plan’s own image.'
                : 'Its own plan image, scale and north angle are deleted with it.'}
            </p>
          )}
          {onlyRegions > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-ui-ink">{regionsText} only on this stage.</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="stage-region-fate" checked={mode === 'carry'} onChange={() => setMode('carry')} className="accent-ui-accent" />
                {keepOnPlan ? 'Keep them on the plan' : 'Carry them to:'}
              </label>
              {!keepOnPlan && mode === 'carry' && (
                <div className="ml-6 flex flex-wrap gap-x-3 gap-y-1.5">
                  {otherStages.map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={carryTo.includes(s.id)}
                        onChange={() => setCarryTo((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                        className="accent-ui-accent"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="stage-region-fate" checked={mode === 'delete'} onChange={() => setMode('delete')} className="accent-ui-accent" />
                Delete them too
              </label>
            </fieldset>
          )}
          {!ownImage && onlyRegions === 0 && <p>No regions are only on this stage, so nothing else goes with it.</p>}
          {!canConfirm && <p className="text-micro text-ui-danger">Tick a stage to carry them to, or choose to delete them.</p>}
          <p className="text-micro text-ui-ink-3">Undo brings it all back.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="raised" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(mode === 'delete' ? 'delete' : { carryTo: keepOnPlan ? [] : carryTo })}
          >
            Delete stage
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
