import { useEffect, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

// Keyboard and touch input for presenting, shared by Presenter (the audience
// screen) and the presenter view (the laptop), so the same keys do the same
// thing on either one. The bindings follow PowerPoint's and Google Slides'
// slide-show keys, since that's what anyone presenting already knows, and
// what presentation clickers send (PageUp/PageDown, and "." for blank).

export interface DeckKeyActions {
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  /** 1-based, counted like the "N / M" counter. */
  jumpTo: (n: number) => void;
  toggleBlack: () => void;
  /** Esc, when no slide number is being typed. */
  escape?: () => void;
  /** Single-key extras by lower-cased `e.key`, e.g. Presenter's f / s / ?. */
  extra?: Record<string, () => void>;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);
/** A half-typed number is dropped after this long, so a stray digit can't
 *  combine with one typed much later. */
const NUMBER_TIMEOUT_MS = 3000;
const MAX_DIGITS = 4;

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
  );
}

/** Binds the presenting keys on `window` for as long as the calling component
 *  is mounted. Returns the digits typed so far toward a jump (e.g. "12" on
 *  the way to "12 Enter"), so the page can show what's about to happen.
 *
 *  Overlays that need a key for themselves (Lightbox, SpaceDetailOverlay,
 *  Menu) already take it in the capture phase and stop it, so they never
 *  reach this bubble-phase listener. Anything with a Ctrl/⌘/Alt modifier is
 *  left to the browser. */
export function useDeckKeys(actions: DeckKeyActions): { pendingNumber: string } {
  const [pendingNumber, setPendingNumber] = useState('');
  // The listener is bound once; the actions it calls are always this
  // render's, so they see current state (black on/off, the slide list).
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setBuffer = (next: string) => {
      buffer = next;
      setPendingNumber(next);
      clearTimeout(timer);
      if (next) timer = setTimeout(() => setBuffer(''), NUMBER_TIMEOUT_MS);
    };

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return;
      const a = actionsRef.current;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (buffer.length < MAX_DIGITS) setBuffer(buffer + e.key);
        return;
      }
      if (buffer) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const n = parseInt(buffer, 10);
          setBuffer('');
          if (n > 0) a.jumpTo(n);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          setBuffer(buffer.slice(0, -1));
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setBuffer('');
          return;
        }
        // Any other key abandons the number, the same as PowerPoint.
        setBuffer('');
      }

      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        a.next();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        a.prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        a.first();
      } else if (e.key === 'End') {
        e.preventDefault();
        a.last();
      } else if (e.key === 'Escape') {
        a.escape?.();
      } else if (!e.repeat) {
        // Toggles ignore auto-repeat, so holding B doesn't strobe the screen.
        const key = e.key.toLowerCase();
        const action = key === 'b' || key === '.' ? a.toggleBlack : a.extra?.[key];
        if (action) {
          e.preventDefault();
          action();
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, []);

  return { pendingNumber };
}

/** Horizontal distance a finger has to travel, and how much more sideways
 *  than vertical the movement has to be, before a touch counts as a swipe
 *  rather than a tap, a scroll or a wobble. */
const SWIPE_MIN_PX = 60;
const SWIPE_DOMINANCE = 1.6;
const SWIPE_MAX_MS = 800;

/** Controls and in-slide pieces that own their own touch drags: a swipe that
 *  starts on one of them belongs to it, not to the deck. The drag cursors
 *  catch the ones that aren't form controls — Material Compare's ↔ handle
 *  (`cursor-ew-resize`) and a zoomed-in Linked Views plan (`cursor-grab`),
 *  which pans under the finger. */
const OWN_GESTURE_SELECTOR = 'button, a, input, textarea, select, video, audio, [role="slider"], [contenteditable="true"]';
const DRAG_CURSORS = new Set(['grab', 'grabbing', 'move', 'ew-resize', 'ns-resize', 'col-resize', 'row-resize']);

function startsOwnGesture(target: EventTarget | null, root: Element): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
    if (el.matches(OWN_GESTURE_SELECTOR)) return true;
    if (DRAG_CURSORS.has(getComputedStyle(el).cursor)) return true;
  }
  return false;
}

/** Touch-swipe navigation: spread the returned handlers onto the element that
 *  should listen. Swiping left (finger moving right to left) goes forward,
 *  the way paging through photos does. One finger only: a pinch never
 *  counts. React's own touch listeners are passive, so nothing here blocks
 *  the page from scrolling or zooming. */
export function useSwipe(actions: { left: () => void; right: () => void }) {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return {
    onTouchStart(e: ReactTouchEvent<HTMLElement>) {
      const touch = e.touches[0];
      start.current =
        e.touches.length === 1 && touch && !startsOwnGesture(e.target, e.currentTarget)
          ? { x: touch.clientX, y: touch.clientY, t: e.timeStamp }
          : null;
    },
    onTouchMove(e: ReactTouchEvent<HTMLElement>) {
      if (e.touches.length > 1) start.current = null;
    },
    onTouchEnd(e: ReactTouchEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!s || !touch || e.touches.length > 0 || e.timeStamp - s.t > SWIPE_MAX_MS) return;
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
      if (dx < 0) actionsRef.current.left();
      else actionsRef.current.right();
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
