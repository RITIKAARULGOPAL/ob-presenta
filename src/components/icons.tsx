// Small inline icons for spots that had none — Properties panel section
// headers, the Add-slide and Export menu items, homepage Delete. Matches the
// stroke SVG already used for "New presentation" (page.tsx) and the merge
// diagram's result badge (SlideRenderer.tsx): viewBox 0 24 24, round caps and
// joins, no fill, sized and colored by the caller via `className` (currentColor
// means each icon just inherits its button's existing text color — no new
// palette decisions here).

import type { SVGProps } from 'react';

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

/** Slide Style — stacked layers, for a set of visual-treatment presets. */
export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </Base>
  );
}

/** Slide Layout — a 2x2 grid, for structure/composition. */
export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.3" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.3" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.3" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.3" />
    </Base>
  );
}

/** Typography — a capital T, for the deck's headline face. */
export function IconType(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 6h16M12 6v13" />
    </Base>
  );
}

/** Logo & Copyright — a picture frame, for the client/OB logo mark. */
export function IconImage(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="M21 16l-5.7-5.7a1 1 0 00-1.4 0L7 17" />
    </Base>
  );
}

/** Linked Slides — a chain link. */
export function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 7l1-1a4 4 0 015.7 5.7l-1.5 1.5" />
      <path d="M13 17l-1 1a4 4 0 01-5.7-5.7l1.5-1.5" />
    </Base>
  );
}

/** Accent Colour — a paint drop. */
export function IconDroplet(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.3s7 7.6 7 12.1a7 7 0 11-14 0c0-4.5 7-12.1 7-12.1z" />
    </Base>
  );
}

/** Homepage Delete action. */
export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
      <path d="M6 7l1 12.5A2 2 0 009 21.5h6a2 2 0 002-1.5L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

/** Concept library — a lightbulb, for curated ready-made ideas. */
export function IconBulb(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 00-3.5 10.9c.4.35.5.85.5 1.35V16h6v-.75c0-.5.1-1 .5-1.35A6 6 0 0012 3z" />
    </Base>
  );
}

/** Title + Content — a titled block of text lines. */
export function IconTextBlock(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1.6" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5.5" />
    </Base>
  );
}

/** Merge Diagram — the same star the slide itself draws for its result badge,
 *  so the menu item and the slide it creates read as the same thing. */
export function IconStar(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" />
    </Base>
  );
}

/** Stat Hero — an ascending bar chart, for a big headline number. */
export function IconBars(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5 20V13M12 20V6M19 20V15" />
    </Base>
  );
}

/** Export as PDF — a document with a folded corner. */
export function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6.5 2.5h8l5 5v13a1.5 1.5 0 01-1.5 1.5h-11a1.5 1.5 0 01-1.5-1.5V4a1.5 1.5 0 011.5-1.5z" />
      <path d="M14.5 2.5v5h5" />
    </Base>
  );
}

/** Export as PPTX — a screen on a stand, for a slide deck. */
export function IconScreen(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </Base>
  );
}
