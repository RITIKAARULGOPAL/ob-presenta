'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/lib/editorStore';
import { IconChevronDown, IconChevronRight } from './icons';
import type { Slide } from '@/types/slide';

const COLLAPSED_KEY = 'presenta-notes-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** The speaker-notes strip under the editor canvas, where PowerPoint, Keynote
 *  and Google Slides all keep theirs. Collapsible, and it remembers that per
 *  browser: a viewer convenience, not part of the deck. Only ever rendered
 *  client-side (the editor shows "Loading…" until the deck is in the store),
 *  so reading localStorage for the first render is safe. */
export function SpeakerNotes({ slide }: { slide: Slide }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  }

  const firstLine = slide.notes?.split('\n').find((line) => line.trim());

  return (
    <section className="shrink-0 border-t border-ui-line bg-ui-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex h-8 w-full items-center gap-1.5 px-4 text-micro text-ui-ink-3 transition-colors duration-150 ease-ui hover:text-ui-ink-2"
      >
        {collapsed ? <IconChevronRight className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />}
        <span className="font-bold uppercase tracking-wide">Speaker notes</span>
        {collapsed && firstLine && <span className="ml-2 min-w-0 truncate text-ui-ink-2">{firstLine}</span>}
        <span className="ml-auto hidden shrink-0 pl-3 sm:inline">Shown in the presenter view, never on the slide</span>
      </button>
      {/* Keyed by slide so each slide starts from its own saved notes. */}
      {!collapsed && <NotesField key={slide.id} slide={slide} />}
    </section>
  );
}

/** Holds a local draft and saves it on blur, the same as EditableText does
 *  for slide fields. Saving per keystroke would push an undo entry and upload
 *  the whole deck for every letter typed. */
function NotesField({ slide }: { slide: Slide }) {
  const setSlideNotes = useEditorStore((s) => s.setSlideNotes);
  const [draft, setDraft] = useState(slide.notes ?? '');

  // Undo and redo can change the saved notes underneath the draft. Following
  // them here, during render, rather than in an effect is the same reset
  // pattern the Properties panel uses for its own per-slide state.
  const [seen, setSeen] = useState(slide.notes);
  if (seen !== slide.notes) {
    setSeen(slide.notes);
    setDraft(slide.notes ?? '');
  }

  // Anything still unsaved when the box goes away is written on the way out
  // too: browsers don't reliably fire blur on a focused element that's
  // removed from the page.
  const latest = useRef({ id: slide.id, draft, saved: slide.notes ?? '' });
  useEffect(() => {
    latest.current = { id: slide.id, draft, saved: slide.notes ?? '' };
  });
  useEffect(
    () => () => {
      const { id, draft: text, saved } = latest.current;
      if (text !== saved) useEditorStore.getState().setSlideNotes(id, text);
    },
    [],
  );

  return (
    <textarea
      aria-label="Speaker notes"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => setSlideNotes(slide.id, draft)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.blur();
      }}
      placeholder="Add notes for this slide. Only you see them, in the presenter view."
      className="block h-20 w-full resize-none bg-transparent px-4 pb-3 text-ctl leading-relaxed text-ui-ink outline-none placeholder:text-ui-ink-3"
    />
  );
}
