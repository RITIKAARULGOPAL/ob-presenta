'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ScaledStage } from '@/components/ScaledStage';
import { PresenterSidebar, type PresenterSection } from '@/components/PresenterSidebar';
import { PresenterShortcuts } from '@/components/PresenterShortcuts';
import { IconFullscreen, IconFullscreenExit, IconSpeakerNotes } from '@/components/icons';
import { useDeckKeys, useSwipe } from '@/lib/deckInput';
import { exitFullscreen, isFullscreen, toggleFullscreen, useFullscreenSupported, useIsFullscreen } from '@/lib/fullscreen';
import { openPresenterView, resolveStartSlide, shownSlides } from '@/lib/presenting';
import { usePresenterSync } from '@/lib/presenterSync';
import type { Slide } from '@/types/slide';

const KBD = 'rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none';

/** Floating live preview shown above a hovered nav dot — the same
 *  SlideRenderer the main stage uses, just scaled way down inside a fixed
 *  1280×720 box (the same reference canvas ScaledStage/export assume), so a
 *  freeform/linked-views slide previews exactly as it'll actually look
 *  rather than a stale static thumbnail. Silent, so hovering a Linked Views
 *  slide doesn't start its background music. */
function DotPreview({ slide }: { slide: Slide }) {
  const w = 176;
  const h = 99; // 16:9
  const label = slide.fields.title || slide.fields.kickerLabel;
  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 overflow-hidden rounded-lg border border-white/15 bg-[#171310] shadow-2xl"
      style={{ width: w, height: h }}
    >
      <div style={{ width: 1280, height: 720, transform: `scale(${w / 1280})`, transformOrigin: 'top left' }}>
        <SlideRenderer slide={slide} editable={false} silent />
      </div>
      {label && (
        <div className="absolute inset-x-0 bottom-0 truncate bg-[#241d16]/75 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
          {label}
        </div>
      )}
    </div>
  );
}

/** A round icon button in the bottom-right controls pill. Hands focus back to
 *  the page after a mouse click: left on the button, the next Enter would
 *  press it again instead of reaching the deck. A keyboard press (detail 0)
 *  keeps focus where the keyboard user put it. */
function PillButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        onClick();
        if (e.detail > 0) e.currentTarget.blur();
      }}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

export default function PresenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [black, setBlackState] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // `seq` makes a repeat of the same message restart its timer.
  const [notice, setNotice] = useState<{ text: string; seq: number } | null>(null);

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);
  const setMode = useEditorStore((s) => s.setMode);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const fullscreen = useIsFullscreen();
  const canFullscreen = useFullscreenSupported();

  useEffect(() => {
    // Read once, here, rather than through the page's searchParams: the URL
    // is rewritten on every slide change below, and none of that should
    // re-run this.
    const requested = new URLSearchParams(window.location.search).get('slide');
    function start(slides: Slide[]) {
      // The store steps over skipped slides only in presenter mode, and the
      // deck may well open on one.
      setMode('presenter');
      const first = resolveStartSlide(slides, requested);
      if (first) selectSlide(first.id);
      setReady(true);
    }
    // Coming from the editor, present exactly what's on screen. A re-fetch
    // would drop anything the database can't hold yet (logo, accent, fonts
    // while migrations 0003–0005 are missing).
    const inMemory = useEditorStore.getState().project;
    if (inMemory?.id === id) {
      start(inMemory.slides);
      return;
    }
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
        start(p.slides);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep ?slide= on whatever's showing, so a reload (or a clicker's F5)
  // comes back here rather than to the first slide. replaceState, not push:
  // stepping through a deck shouldn't fill the back button with every slide.
  const currentSlideId = currentSlide?.id;
  useEffect(() => {
    if (!ready || !currentSlideId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('slide') === currentSlideId) return;
    url.searchParams.set('slide', currentSlideId);
    window.history.replaceState(null, '', url);
  }, [ready, currentSlideId]);

  // Leaving Presenter by any route (Esc, the back button) leaves full screen
  // too. Deferred, and only once Presenter is really gone from the page: in
  // development React runs this cleanup once straight after mounting, and
  // exiting then would undo the full screen the editor's Present button just
  // asked for.
  useEffect(
    () => () => {
      setTimeout(() => {
        if (!document.querySelector('[data-presenter]')) exitFullscreen();
      }, 0);
    },
    [],
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const flash = (text: string) => setNotice((n) => ({ text, seq: (n?.seq ?? 0) + 1 }));

  const { setBlack } = usePresenterSync({
    projectId: id,
    role: 'audience',
    active: ready,
    black,
    onBlack: setBlackState,
    onPeerJoined: () => {
      if (!isFullscreen()) flash('Presenter view connected. Move this window to the audience screen, then press F for full screen.');
    },
  });

  const shown = project ? shownSlides(project.slides) : [];
  const shownIndex = shown.findIndex((s) => s.id === currentSlide?.id);

  // Moving to any slide ends a black screen: the presenter is plainly ready
  // to carry on, and a still-black screen would hide that the deck moved.
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
  function leave() {
    exitFullscreen();
    router.push(`/p/${id}/edit`);
  }
  function openView() {
    if (!openPresenterView(id)) flash('Pop-ups are blocked for this site. Allow them to open the presenter view.');
  }

  const { pendingNumber } = useDeckKeys({
    next,
    prev,
    first: () => goTo(shown[0]?.id),
    last: () => goTo(shown[shown.length - 1]?.id),
    // A number past the end goes to the last slide rather than nowhere.
    jumpTo: (n) => goTo(shown[Math.min(n, shown.length) - 1]?.id),
    toggleBlack: () => setBlack(!black),
    escape: () => {
      if (showShortcuts) setShowShortcuts(false);
      else if (black) setBlack(false);
      else leave();
    },
    extra: {
      f: toggleFullscreen,
      s: openView,
      '?': () => setShowShortcuts((v) => !v),
    },
  });
  const swipe = useSwipe({ left: next, right: prev });

  if (!ready || !project) {
    return (
      <div data-presenter className="flex h-screen items-center justify-center bg-[#171310] text-white/40">
        Loading…
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div data-presenter className="flex h-screen flex-col items-center justify-center gap-3 bg-[#171310] text-white/50">
        <p>Every slide in this deck is skipped.</p>
        <button onClick={leave} className="text-sm underline">
          Back to the editor
        </button>
      </div>
    );
  }

  // One group per section — a run of slides starting at a section-starter
  // divider, or wherever a design-option tag changes (e.g. into or out of
  // "Option 1"), or the very first slide, which starts the implicit first
  // group even when it isn't one of the above. Purely a visual clustering of
  // the nav dots; it doesn't change navigation order or which slides are "in"
  // a group beyond "everything up to the next divider." A deck that never
  // sets designOption behaves exactly as before — every comparison below is
  // undefined !== undefined, which is false, so nothing new ever splits it.
  const groups: { slide: (typeof shown)[number]; index: number }[][] = [];
  shown.forEach((s, i) => {
    const optionChanged = (s.designOption?.trim() || undefined) !== (shown[i - 1]?.designOption?.trim() || undefined);
    if (groups.length === 0 || s.style === 'section-starter' || optionChanged) groups.push([]);
    groups[groups.length - 1].push({ slide: s, index: i });
  });

  // A second, coarser grouping for the sidebar — section-starter slides
  // only, ignoring designOption changes (unlike `groups` above, which stays
  // exactly as it was for the dot-row). Hidden entirely (see
  // PresenterSidebar) when this produces fewer than 2 sections, so a deck
  // that never authors a section-starter slide shows no sidebar at all.
  const sections: PresenterSection[] = [];
  shown.forEach((s, i) => {
    if (sections.length === 0 || s.style === 'section-starter') {
      sections.push({ startSlide: s, startIndex: i, endIndex: i });
    } else {
      sections[sections.length - 1].endIndex = i;
    }
  });

  return (
    <div data-presenter className="relative h-screen w-screen bg-[#171310]" {...swipe}>
      {currentSlide && (
        <div className="absolute inset-0">
          {/* Same fixed 1280x720 canvas the editor and export use — without
              this, a layout that positions content by exact pixel/percent
              (e.g. a freeform imported slide) would distort to whatever
              shape the actual browser window happens to be, since nothing
              else here enforces a 16:9 box. fit="cover": Presenter fills the
              physical screen completely (cropping whichever axis overflows
              on a non-16:9 screen) rather than letterboxing — the one place
              that matters more than showing the entire frame at all times,
              unlike the editor's own ScaledStage usage. */}
          <ScaledStage fit="cover">
            <SlideRenderer slide={currentSlide} editable={false} animate interactive />
          </ScaledStage>
        </div>
      )}

      {/* Floats over the slide, left edge, the same rounded/translucent
          treatment as every other piece of chrome below — not a layout
          sibling that reserves its own width. */}
      <PresenterSidebar sections={sections} currentIndex={shownIndex} onSelect={goTo} />

      {/* Presenting controls, then the keyboard legend — kbd-styled keys
          rather than plain prose, so it reads at a glance for someone who's
          never presented from this app before. Only the arrows and Esc fit
          here; ? lists the rest. */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1 rounded-full bg-[#241d16]/40 p-1 text-xs text-white shadow-lg backdrop-blur-sm">
        <PillButton label="Presenter view (S)" onClick={openView}>
          <IconSpeakerNotes className="h-4 w-4" />
        </PillButton>
        {canFullscreen && (
          <PillButton label={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'} onClick={toggleFullscreen}>
            {fullscreen ? <IconFullscreenExit className="h-4 w-4" /> : <IconFullscreen className="h-4 w-4" />}
          </PillButton>
        )}
        {/* Key hints mean nothing on a touch screen, where swiping does the job. */}
        <div className="ml-1 flex items-center gap-1.5 border-l border-white/15 pl-2.5 pr-2 pointer-coarse:hidden">
          <kbd className={KBD}>←</kbd>
          <kbd className={KBD}>→</kbd>
          <span className="text-white/60">navigate</span>
          <span className="mx-0.5 text-white/25">·</span>
          <kbd className={KBD}>?</kbd>
          <span className="text-white/60">shortcuts</span>
          <span className="mx-0.5 text-white/25">·</span>
          <kbd className={KBD}>Esc</kbd>
          <span className="text-white/60">exit</span>
        </div>
      </div>

      {/* Progress rail: step count + a one-line hint, a slim fill bar, and a
          row of clickable dots (grouped by section, hover-previewed) for
          jump-to-slide — the deck's own navigation chrome, not part of any
          one slide's content. */}
      <div className="absolute bottom-6 left-1/2 flex max-w-[70vw] -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex w-full flex-col items-center gap-1.5 rounded-2xl bg-[#241d16]/40 px-4 py-1.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3 text-xs text-white">
            <span className="font-semibold tabular-nums">
              {shownIndex + 1} / {shown.length}
            </span>
            {(currentSlide?.fields.kickerLabel || currentSlide?.fields.title) && (
              <span className="max-w-[40vw] truncate text-white/70">
                {currentSlide?.fields.kickerLabel || currentSlide?.fields.title}
              </span>
            )}
          </div>
          <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${((shownIndex + 1) / shown.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-[#241d16]/40 px-3 py-2 shadow-lg backdrop-blur-sm">
          {groups.map((group, gi) => (
            <div
              key={group[0]?.slide.id ?? gi}
              className={`flex items-center gap-1.5 ${gi > 0 ? 'ml-1.5 border-l border-white/15 pl-1.5' : ''}`}
            >
              {group.map(({ slide: s, index: i }) => (
                <button
                  key={s.id}
                  onClick={() => goTo(s.id)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                  aria-label={`Go to slide ${i + 1}${s.fields.title ? `: ${s.fields.title}` : ''}`}
                  aria-current={i === shownIndex}
                  className={`relative h-1.5 rounded-full transition-all duration-200 ${
                    i === shownIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/35 hover:w-2.5 hover:bg-white/70'
                  }`}
                >
                  {hoveredIndex === i && <DotPreview slide={s} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {notice && !black && !pendingNumber && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-6 z-30 w-max max-w-[min(90vw,34rem)] -translate-x-1/2 rounded-2xl bg-[#241d16]/85 px-4 py-2.5 text-center text-xs leading-snug text-white shadow-lg backdrop-blur-sm"
        >
          {notice.text}
        </div>
      )}

      {showShortcuts && <PresenterShortcuts canFullscreen={canFullscreen} onClose={() => setShowShortcuts(false)} />}

      {/* Nothing on screen but black, chrome included: the point is to take
          the room's eyes off the screen. A click brings the slide back, so a
          mouse user is never stuck behind it. */}
      {black && <div aria-hidden className="fixed inset-0 z-50 cursor-none bg-black" onClick={() => setBlack(false)} />}

      {/* Above the black screen on purpose: typing a number is how the
          presenter means to come back from it, and they need to see what
          they've typed. */}
      {pendingNumber && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-6 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#241d16]/85 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm"
        >
          <span className="text-white/60">Go to slide</span>
          <span className="font-semibold tabular-nums">{pendingNumber}</span>
          <span className="text-white/40">of {shown.length}</span>
          <kbd className={KBD}>Enter</kbd>
        </div>
      )}
    </div>
  );
}
