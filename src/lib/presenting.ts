import type { Slide } from '@/types/slide';

// Shared by the editor's Present menu, Presenter (the audience screen) and
// the presenter view (the laptop screen), so all three agree on what "slide
// 5" means and where a presentation starts.

/** The slides a presentation walks through. Skipped slides stay in the deck
 *  but out of this telling of it, so every "N / M" counter and the
 *  type-a-number-to-jump key count against this list, never the raw deck. */
export function shownSlides(slides: Slide[]): Slide[] {
  return slides.filter((s) => !s.skipped);
}

/** Where a presentation opens when asked to start at `requestedId`: that
 *  slide, or, when it's skipped, the next shown slide after it, then the
 *  nearest shown one before it. No request (or an id that no longer exists)
 *  starts at the first shown slide. */
export function resolveStartSlide(slides: Slide[], requestedId: string | null | undefined): Slide | undefined {
  const at = requestedId ? slides.findIndex((s) => s.id === requestedId) : -1;
  if (at === -1) return slides.find((s) => !s.skipped);
  return slides.slice(at).find((s) => !s.skipped) ?? slides.slice(0, at).reverse().find((s) => !s.skipped);
}

/** Presenter for a deck, optionally opening on a given slide. Presenter keeps
 *  `?slide=` current as it goes, so a reload (or a clicker that sends F5)
 *  comes back to the same slide instead of the first. */
export function presentUrl(projectId: string, slideId?: string | null): string {
  return `/p/${projectId}/present${slideId ? `?slide=${encodeURIComponent(slideId)}` : ''}`;
}

export function presenterViewUrl(projectId: string): string {
  return `/p/${projectId}/presenter-view`;
}

/** One name for every deck, so opening the presenter view for a second deck
 *  reuses the window rather than stacking up another one. */
const PRESENTER_VIEW_WINDOW = 'presenta-presenter-view';

/** Opens the presenter view in its own window, or brings the open one
 *  forward. Must run inside a user gesture (a click or a key press) or the
 *  pop-up blocker stops it; returns false when it was blocked.
 *
 *  An already-open presenter view is focused, not navigated: navigating it
 *  would reload it and reset its timer. Opening by name with an empty URL is
 *  what makes that possible: it hands back the existing window untouched, or
 *  a fresh about:blank one to point at the presenter view. */
export function openPresenterView(projectId: string): boolean {
  const w = window.open('', PRESENTER_VIEW_WINDOW, 'popup,width=1200,height=760');
  if (!w) return false;
  const target = new URL(presenterViewUrl(projectId), window.location.origin);
  let alreadyThere = false;
  try {
    alreadyThere = w.location.pathname === target.pathname;
  } catch {
    // Somewhere cross-origin: can't be read, so it can't be the presenter view.
  }
  if (!alreadyThere) w.location.replace(target.href);
  w.focus();
  return true;
}
