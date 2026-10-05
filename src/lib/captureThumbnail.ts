import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import * as htmlToImage from 'html-to-image';
import { SlideRenderer } from '@/components/SlideRenderer';
import { useEditorStore } from '@/lib/editorStore';
import { settleStage, SLIDE_W, SLIDE_H } from '@/lib/exportDeck';
import type { Project, ProjectSummary } from '@/types/slide';

// Sharp enough at card size, far cheaper to capture than export's pixelRatio: 2
// (which targets a full 1280-wide slide, not a ~270px-wide grid card).
const THUMBNAIL_PIXEL_RATIO = 0.45;

// Belt-and-suspenders: captures are strictly serialized (one project at a
// time through the store's single slot), so anything that makes one capture
// hang instead of resolving/rejecting would silently wedge every card behind
// it forever. The main known cause (the tab going hidden mid-capture, which
// suspends requestAnimationFrame and stalls settleStage indefinitely — see
// page.tsx's visibility guard, which prevents *starting* a capture while
// hidden) is handled at the source; this bounded timeout is what limits the
// damage from that or any other unexpected hang to just the one slide.
const CAPTURE_TIMEOUT_MS = 8000;

/** SlideRenderer and its siblings (ClientLogo/BrandFooter/LinkedSlideChips)
 *  read accent/font/typography/logo straight from the global editorStore,
 *  not from a prop — there's no way to render "some other project" without
 *  briefly making it the store's project. `__thumbnail` never collides with
 *  a real project id (makeId() never produces it), which matters: the edit
 *  page skips its own fetch when the store already holds a project with the
 *  id it's about to open, and this id must never be mistaken for that. */
function buildThumbnailProject(source: ProjectSummary): Project | null {
  if (!source.firstSlide) return null;
  return {
    id: `${source.id}__thumbnail`,
    name: source.name,
    client: source.client,
    preparedBy: '',
    date: source.date,
    brand: source.brand,
    clientLogo: source.clientLogo,
    accentColor: source.accentColor,
    fontFamily: source.fontFamily,
    typography: source.typography,
    slides: [source.firstSlide],
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}

let chain: Promise<unknown> = Promise.resolve();

/** Self-serializing: the store has exactly one `project` slot, so two
 *  captures must never swap it concurrently, regardless of how many callers
 *  overlap (Home's own capture loop already awaits one at a time, but this
 *  makes the function safe to call from anywhere without that discipline). */
export function captureProjectThumbnail(source: ProjectSummary): Promise<string | null> {
  const result = chain.then(() => captureOnce(source));
  chain = result.catch(() => undefined);
  return result;
}

async function captureOnce(source: ProjectSummary): Promise<string | null> {
  const project = buildThumbnailProject(source);
  if (!project) return null;

  // Same split as exportDeck.ts's captureSlides: html-to-image clones the
  // CAPTURED node's own computed style, so the offscreen hiding has to live
  // on an outer wrapper, never on the stage itself.
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '-99999px';
  wrapper.style.width = `${SLIDE_W}px`;
  wrapper.style.height = `${SLIDE_H}px`;
  wrapper.style.overflow = 'hidden';
  const stage = document.createElement('div');
  stage.style.width = `${SLIDE_W}px`;
  stage.style.height = `${SLIDE_H}px`;
  stage.style.overflow = 'hidden';
  stage.style.background = '#ffffff';
  wrapper.appendChild(stage);
  document.body.appendChild(wrapper);
  const root = createRoot(stage);

  const prior = useEditorStore.getState().project;
  useEditorStore.setState({ project });

  // Cleanup is deferred to whenever `capture` itself actually settles, not
  // run eagerly the instant a timeout wins the race below — html-to-image
  // reads the live `stage` subtree asynchronously, so tearing it down
  // (unmount/remove) while that read might still be in flight is avoidable
  // risk for no benefit; the store restore is separately compare-guarded
  // anyway, so nothing needs the DOM cleanup to happen immediately either.
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (useEditorStore.getState().project === project) {
      useEditorStore.setState({ project: prior });
    }
    root.unmount();
    wrapper.remove();
  };

  const capture = (async () => {
    await document.fonts.ready;
    root.render(createElement(SlideRenderer, { slide: project.slides[0], editable: false, silent: true }));
    await settleStage(stage);
    return await htmlToImage.toPng(stage, {
      width: SLIDE_W,
      height: SLIDE_H,
      pixelRatio: THUMBNAIL_PIXEL_RATIO,
      cacheBust: true,
    });
  })();
  capture.then(cleanup, cleanup);

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS));

  try {
    return await Promise.race([capture, timeout]);
  } catch (err) {
    console.error(`Thumbnail capture failed for "${source.name}":`, err);
    return null;
  }
}
