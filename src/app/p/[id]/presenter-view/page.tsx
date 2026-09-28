'use client';

import { use, useEffect, useRef, useState } from 'react';
import { getProject } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ScaledStage } from '@/components/ScaledStage';
import { Button, IconButton, ToolbarDivider } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Menu';
import {
  IconBlackScreen, IconChevronLeft, IconChevronRight, IconMinus, IconPause, IconPlay, IconPlus, IconRestart,
} from '@/components/icons';
import { useDeckKeys, useSwipe } from '@/lib/deckInput';
import { presentUrl, resolveStartSlide, shownSlides } from '@/lib/presenting';
import { usePresenterSync } from '@/lib/presenterSync';
import type { Project, Slide } from '@/types/slide';

// The presenter view: the laptop-screen half of presenting with a projector.
// The current slide, the next one, this slide's speaker notes, a timer and
// the clock, in a window of its own, while Presenter shows the slide to the
// room. The two stay on the same slide through presenterSync.ts, and either
// one can drive.
//
// Always dark, whatever the app's theme: it sits in front of the presenter in
// a dimmed room. It uses the app's own dark tokens (a data-theme="dark"
// wrapper re-scopes them) rather than Presenter's hard-coded palette.

/** How long to wait for an audience screen to hand over its deck before
 *  loading one from the database instead. A presenter view opened on its own
 *  to rehearse has nobody to ask. */
const AUDIENCE_WAIT_MS = 1500;

const NOTES_SIZES = [14, 16, 18, 20, 24, 28, 32, 40];
const DEFAULT_NOTES_SIZE = 20;
const NOTES_SIZE_KEY = 'presenta-presenter-notes-size';

/** Remembered per browser: how big the presenter needs their notes is about
 *  their eyes and their laptop, not about the deck. */
function readNotesSize(): number {
  try {
    const n = Number(localStorage.getItem(NOTES_SIZE_KEY));
    return NOTES_SIZES.includes(n) ? n : DEFAULT_NOTES_SIZE;
  } catch {
    return DEFAULT_NOTES_SIZE;
  }
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A slide as a passive picture: the whole 1280×720 frame fitted into its
 *  box, inert (the live slide is on the audience screen, so nothing in here
 *  should take a click or a tab stop) and silent (the audience screen is the
 *  one playing any background music). */
function SlidePane({ slide }: { slide: Slide }) {
  return (
    <div inert className="h-full w-full">
      <ScaledStage>
        <SlideRenderer slide={slide} editable={false} silent />
      </ScaledStage>
    </div>
  );
}

export default function PresenterViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [black, setBlackState] = useState(false);
  // Ticks once a second for the clock and the timer; 0 until the first tick.
  const [now, setNow] = useState(0);
  // Time run up before the current run, and when the current run started
  // (null while paused).
  const [timer, setTimer] = useState<{ before: number; since: number | null }>({ before: 0, since: null });
  // Only ever rendered after the deck arrives, never during hydration, so
  // reading storage for the first value can't cause a mismatch.
  const [notesSize, setNotesSize] = useState(readNotesSize);
  const gotDeckRef = useRef(false);

  const project = useEditorStore((s) => s.project);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const loadProject = useEditorStore((s) => s.loadProject);
  const setMode = useEditorStore((s) => s.setMode);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);

  function adopt(p: Project, slideId: string | null) {
    loadProject(p);
    // Walks past skipped slides, the same as the audience screen does.
    setMode('presenter');
    const start = resolveStartSlide(p.slides, slideId);
    if (start) selectSlide(start.id);
    if (!gotDeckRef.current) {
      gotDeckRef.current = true;
      setTimer({ before: 0, since: Date.now() });
    }
    setReady(true);
  }

  const { connected, setBlack } = usePresenterSync({
    projectId: id,
    role: 'view',
    active: ready,
    black,
    onBlack: setBlackState,
    onState: adopt,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      if (gotDeckRef.current) return;
      getProject(id).then((p) => {
        // An audience screen may have answered while this was loading; its
        // copy wins, since it's the one the room is looking at.
        if (gotDeckRef.current) return;
        if (p) adopt(p, null);
        else setMissing(true);
      });
    }, AUDIENCE_WAIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const shown = project ? shownSlides(project.slides) : [];
  const shownIndex = shown.findIndex((s) => s.id === currentSlide?.id);
  const nextSlide = shownIndex >= 0 ? shown[shownIndex + 1] : undefined;

  // Moving to any slide ends a black screen, the same rule as Presenter's.
  function goTo(slideId: string | undefined) {
    if (black) setBlack(false);
    if (slideId) selectSlide(slideId);
  }
  function next() {
    if (black) setBlack(false);
    goNext();
  }
  function prev() {
    if (black) setBlack(false);
    goPrev();
  }

  const { pendingNumber } = useDeckKeys({
    next,
    prev,
    first: () => goTo(shown[0]?.id),
    last: () => goTo(shown[shown.length - 1]?.id),
    jumpTo: (n) => goTo(shown[Math.min(n, shown.length) - 1]?.id),
    toggleBlack: () => setBlack(!black),
    escape: () => {
      if (black) setBlack(false);
    },
  });
  const swipe = useSwipe({ left: next, right: prev });

  const running = timer.since != null;
  const elapsed = timer.before + (timer.since != null ? Math.max(0, now - timer.since) : 0);

  function toggleTimer() {
    const t = Date.now();
    setTimer((s) => (s.since != null ? { before: s.before + (t - s.since), since: null } : { before: s.before, since: t }));
  }
  function restartTimer() {
    const t = Date.now();
    setNow(t);
    setTimer((s) => ({ before: 0, since: s.since != null ? t : null }));
  }
  function changeNotesSize(step: 1 | -1) {
    const at = NOTES_SIZES.indexOf(notesSize);
    const size = NOTES_SIZES[Math.max(0, Math.min(NOTES_SIZES.length - 1, at + step))];
    setNotesSize(size);
    try {
      localStorage.setItem(NOTES_SIZE_KEY, String(size));
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  }
  // For when the audience screen was closed mid-talk: a fresh one opens on
  // the slide this view is on.
  function openAudience() {
    window.open(presentUrl(id, currentSlide?.id), 'presenta-audience');
  }

  if (missing || !ready || !project) {
    return (
      <div data-theme="dark" className="flex h-screen items-center justify-center bg-ui-bg text-ctl text-ui-ink-3">
        {missing ? 'Couldn’t find that presentation.' : 'Loading…'}
      </div>
    );
  }

  const title = currentSlide?.fields.title || currentSlide?.fields.kickerLabel;
  const notes = currentSlide?.notes;

  return (
    <div data-theme="dark" className="flex h-screen flex-col bg-ui-bg text-ui-ink" {...swipe}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ui-line bg-ui-surface px-4">
        <span className="shrink-0 text-micro font-bold uppercase tracking-wide text-ui-ink-3">Presenter view</span>
        <span className="min-w-0 truncate text-ctl font-semibold">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-micro text-ui-ink-2">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ui-line-strong'}`} />
          {connected ? 'Audience screen connected' : 'No audience screen'}
        </span>
        {!connected && (
          <button type="button" onClick={openAudience} className="shrink-0 text-micro font-semibold text-ui-accent hover:underline">
            Open one
          </button>
        )}

        <span className="flex-1" />

        <span className="text-title font-semibold tabular-nums" title="Time presenting">
          {formatElapsed(elapsed)}
        </span>
        <IconButton
          size="sm"
          label={running ? 'Pause the timer' : 'Resume the timer'}
          icon={running ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="h-3 w-3" />}
          onClick={toggleTimer}
        />
        <IconButton size="sm" label="Restart the timer" icon={<IconRestart className="h-3.5 w-3.5" />} onClick={restartTimer} />
        <ToolbarDivider />
        <span className="min-w-16 text-right text-ctl tabular-nums text-ui-ink-2" title="Time of day">
          {now ? new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row">
        <section aria-label="Current slide" className="flex min-h-0 min-w-0 flex-[3] flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-ui-lg bg-black ring-1 ring-ui-line">
            {currentSlide && <SlidePane slide={currentSlide} />}
            {black && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
                <p className="text-body font-semibold text-white">The audience screen is black</p>
                <Button variant="raised" onClick={() => setBlack(false)}>
                  Show the slide again
                </Button>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="raised" icon={<IconChevronLeft className="h-3.5 w-3.5" />} onClick={prev} disabled={shownIndex <= 0}>
              Previous
            </Button>
            <Button
              variant="primary"
              trailing={<IconChevronRight className="h-3.5 w-3.5" />}
              onClick={next}
              disabled={shownIndex === -1 || shownIndex >= shown.length - 1}
            >
              Next
            </Button>
            <span className="ml-2 min-w-0 truncate text-ctl text-ui-ink-2">
              <span className="font-semibold tabular-nums text-ui-ink">
                {shownIndex >= 0 ? `${shownIndex + 1} / ${shown.length}` : `– / ${shown.length}`}
              </span>
              {title && <span> · {title}</span>}
            </span>
            <span className="flex-1" />
            <Button
              variant="raised"
              icon={<IconBlackScreen className="h-[15px] w-[15px]" />}
              onClick={() => setBlack(!black)}
              aria-pressed={black}
              title="Black screen (B)"
            >
              {black ? 'Show slide' : 'Black screen'}
            </Button>
          </div>
        </section>

        <aside className="flex min-h-0 min-w-0 flex-[2] flex-col gap-4">
          <div className="shrink-0">
            <h2 className="mb-2 text-micro font-bold uppercase tracking-wide text-ui-ink-3">Next</h2>
            <div className="aspect-video overflow-hidden rounded-ui-md bg-black ring-1 ring-ui-line">
              {nextSlide ? (
                <SlidePane slide={nextSlide} />
              ) : (
                <div className="flex h-full items-center justify-center text-ctl text-ui-ink-3">End of the presentation</div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center gap-1">
              <h2 className="text-micro font-bold uppercase tracking-wide text-ui-ink-3">Notes</h2>
              <span className="flex-1" />
              <IconButton
                size="sm"
                label="Smaller notes"
                icon={<IconMinus className="h-3.5 w-3.5" />}
                onClick={() => changeNotesSize(-1)}
                disabled={notesSize === NOTES_SIZES[0]}
              />
              <IconButton
                size="sm"
                label="Larger notes"
                icon={<IconPlus className="h-3.5 w-3.5" />}
                onClick={() => changeNotesSize(1)}
                disabled={notesSize === NOTES_SIZES[NOTES_SIZES.length - 1]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-ui-md bg-ui-surface p-4 ring-1 ring-ui-line">
              {notes ? (
                <p className="whitespace-pre-wrap break-words leading-relaxed text-ui-ink" style={{ fontSize: notesSize }}>
                  {notes}
                </p>
              ) : (
                <p className="text-ctl text-ui-ink-3">No notes for this slide. Add them in the editor, under the slide.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 overflow-hidden border-t border-ui-line bg-ui-surface px-4 text-micro text-ui-ink-3">
        <span className="flex items-center gap-1">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> change slide
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Home</Kbd>
          <Kbd>End</Kbd> first or last
        </span>
        <span className="flex items-center gap-1">
          <Kbd>12</Kbd>
          <Kbd>↵</Kbd> go to slide 12
        </span>
        <span className="flex items-center gap-1">
          <Kbd>B</Kbd> black screen
        </span>
      </footer>

      {pendingNumber && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ui-line bg-ui-surface px-4 py-2 text-ctl shadow-float"
        >
          <span className="text-ui-ink-3">Go to slide</span>
          <span className="font-semibold tabular-nums">{pendingNumber}</span>
          <span className="text-ui-ink-3">of {shown.length}</span>
          <Kbd>Enter</Kbd>
        </div>
      )}
    </div>
  );
}
