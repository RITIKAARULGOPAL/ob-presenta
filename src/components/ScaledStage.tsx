'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Matches SLIDE_W/SLIDE_H in exportDeck.ts, so the on-screen editor preview is
// the same reference size the PDF/PPTX export rasterizes at.
const STAGE_W = 1280;
const STAGE_H = 720;

/** Scales a fixed 1280x720 slide to exactly fill whatever space its parent
 *  gives it, growing or shrinking with the container instead of clipping or
 *  scrolling. The parent just needs a definite size (e.g. `flex-1 min-h-0`);
 *  this fills it completely and centers the scaled slide inside. */
export function ScaledStage({ children, stageClassName = '' }: { children: React.ReactNode; stageClassName?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
