'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Matches SLIDE_W/SLIDE_H in exportDeck.ts, so the on-screen editor preview is
// the same reference size the PDF/PPTX export rasterizes at.
const STAGE_W = 1280;
const STAGE_H = 720;

/** Scales a fixed 1280x720 slide to exactly fill whatever space its parent
 *  gives it, growing or shrinking with the container instead of clipping or
 *  scrolling. The parent just needs a definite size (e.g. `flex-1 min-h-0`);
 *  this fills it completely and centers the scaled slide inside.
 *
 *  `zoomFactor`/`pannable` are additive, opt-in, and default to today's only
 *  behavior (exact fit, no scrolling) — Presenter mode's own use of this
 *  component passes neither, so it's completely unaffected. They exist for
 *  the editor's own canvas zoom: `zoomFactor` multiplies the auto-fit scale
 *  (1 = fit, same as before), and `pannable` wraps the stage in a native
 *  scrollable viewport instead of centering it with a transform — deliberately
 *  *not* a custom click-drag pan, since that would fight every other
 *  click/drag already on this canvas (text editing, image adjust, freeform
 *  element dragging, hotspot drawing). Native scroll (trackpad, scrollbar,
 *  wheel) doesn't compete with any of those. */
export function ScaledStage({
  children,
  stageClassName = '',
  zoomFactor = 1,
  pannable = false,
}: {
  children: React.ReactNode;
  stageClassName?: string;
  zoomFactor?: number;
  pannable?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setFitScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fitScale * zoomFactor;

  if (!pannable) {
    return (
      <div ref={outerRef} className="relative h-full w-full">
        <div
          className={stageClassName}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: STAGE_W,
            height: STAGE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
            // Scale starts at 0 until the first measurement lands, so the slide
            // never flashes at full 1280px size before shrinking into place.
            visibility: scale ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-auto">
      {/* `flex` on the scroll container + `margin: auto` on the stage (not
          `justify-content`/`align-items: center`) is the deliberate choice
          here: centering via justify/align content clips the "before" edge
          of an overflowing child from ever being scrolled to in some
          browsers — a well-known flexbox+overflow gotcha. margin:auto
          centers it while it fits and cleanly falls back to normal
          block-from-both-true-edges scrolling once it's larger than the
          viewport, with no dead zone either way. */}
      <div className="flex min-h-full min-w-full">
        <div
          className={stageClassName}
          style={{
            margin: 'auto',
            flexShrink: 0,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            visibility: scale ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
