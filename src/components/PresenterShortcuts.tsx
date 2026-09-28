'use client';

import { Fragment } from 'react';
import { IconClose } from './icons';

const KBD = 'rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none';

/** Every presenting key, listed. Opened with "?" in Presenter: the legend
 *  that's always on screen only has room for the arrows and Esc, so without
 *  this the rest (Home/End, jumping to a number, black screen, full screen,
 *  the presenter view) would stay invisible. Same translucent warm chrome as
 *  the rest of Presenter. */
export function PresenterShortcuts({ canFullscreen, onClose }: { canFullscreen: boolean; onClose: () => void }) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ['→', '↓', 'Space', 'PgDn'], label: 'Next slide' },
    { keys: ['←', '↑', 'PgUp'], label: 'Previous slide' },
    { keys: ['Home', 'End'], label: 'First or last slide' },
    { keys: ['12', 'Enter'], label: 'Go to a slide: type its number, then Enter' },
    { keys: ['B', '.'], label: 'Black screen, and back' },
    ...(canFullscreen ? [{ keys: ['F'], label: 'Full screen, and back' }] : []),
    { keys: ['S'], label: 'Presenter view: notes, timer and next slide, in its own window' },
    { keys: ['?'], label: 'Show or hide these shortcuts' },
    { keys: ['Esc'], label: 'Leave the presentation' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="presenter-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#241d16]/95 p-5 text-white shadow-2xl backdrop-blur-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="presenter-shortcuts-title" className="text-sm font-semibold">
            Presenting shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2.5 text-xs">
          {rows.map(({ keys, label }) => (
            <Fragment key={label}>
              <dt className="flex flex-wrap gap-1">
                {keys.map((k) => (
                  <kbd key={k} className={KBD}>
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-white/75">{label}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-4 text-[11px] leading-snug text-white/50">On a touch screen, swipe left or right to change slide.</p>
      </div>
    </div>
  );
}
