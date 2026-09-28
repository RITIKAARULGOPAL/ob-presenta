import { useSyncExternalStore } from 'react';

/** Full screen for presenting, across the one browser that still needs a
 *  prefix: Safari on iPad only ships `webkit`-prefixed element full screen
 *  (Safari on iPhone has none at all, so `fullscreenSupported()` is false
 *  there and the controls hide themselves).
 *
 *  Every entry point swallows its own failure. A request can be refused for
 *  ordinary reasons (no user gesture behind it, a permissions policy, the
 *  user having just pressed Esc), and a presentation that fails to go full
 *  screen must still present. */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function doc(): FsDocument | null {
  return typeof document === 'undefined' ? null : (document as FsDocument);
}

export function fullscreenSupported(): boolean {
  const d = doc();
  return !!d && !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = doc();
  return !!d && !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Must be called from inside a user gesture (a click or a keydown), or the
 *  browser refuses it. The whole document goes full screen rather than one
 *  element, so a client-side navigation into Presenter keeps it. */
export function enterFullscreen(): void {
  const d = doc();
  if (!d || isFullscreen()) return;
  const el = d.documentElement as FsElement;
  try {
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else void Promise.resolve(el.webkitRequestFullscreen?.()).catch(() => {});
  } catch {
    // Refused synchronously (older WebKit throws instead of rejecting).
  }
}

export function exitFullscreen(): void {
  const d = doc();
  if (!d || !isFullscreen()) return;
  try {
    if (d.exitFullscreen) void d.exitFullscreen().catch(() => {});
    else void Promise.resolve(d.webkitExitFullscreen?.()).catch(() => {});
  } catch {
    // Already leaving.
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
  };
}

/** Live full-screen state — it changes from outside React (Esc, F11, the
 *  browser's own exit button), so it's read as an external store rather than
 *  mirrored into component state. False on the server. */
export function useIsFullscreen(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, () => false);
}

const noSubscribe = () => () => {};

/** Whether this browser can go full screen at all — never changes, but it's
 *  client-only knowledge, so it goes through the same hydration-safe hook
 *  (false during SSR) rather than being read during render. */
export function useFullscreenSupported(): boolean {
  return useSyncExternalStore(noSubscribe, fullscreenSupported, () => false);
}
