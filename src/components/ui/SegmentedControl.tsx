'use client';

import type { ReactNode } from 'react';

/** A small set of mutually exclusive choices, shown all at once.
 *
 *  Generalised out of ThemeToggle, which was already exactly this shape. Use
 *  it when there are two to four options and seeing the unchosen ones is
 *  useful; past that a Menu is kinder, and past about six a searchable dialog
 *  is the only honest answer. */

export interface SegmentOption<T extends string> {
  key: T;
  /** Used as the accessible name and the tooltip. */
  label: string;
  icon?: ReactNode;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'chrome',
  className = '',
}: {
  options: SegmentOption<T>[];
  /** null renders nothing as selected — for a value that is not known yet. */
  value: T | null;
  onChange: (key: T) => void;
  ariaLabel: string;
  /** 'hero' sits on the home screen's brand backdrop, which is translucent
   *  over a gradient in dark and a plain card in light. */
  tone?: 'chrome' | 'hero';
  className?: string;
}) {
  const shell = tone === 'hero' ? 'border-hero-line bg-hero-card' : 'border-ui-line bg-ui-raised';
  const idle = tone === 'hero' ? 'text-hero-ink-3 hover:text-hero-ink' : 'text-ui-ink-3 hover:text-ui-ink';
  const selected =
    tone === 'hero' ? 'bg-hero-card-hover text-hero-ink shadow-card' : 'bg-ui-surface text-ui-accent shadow-card';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${shell} ${className}`}
    >
      {options.map(({ key, label, icon }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={`flex h-7 items-center justify-center rounded-full transition-colors duration-150 ease-ui ${
              icon ? 'w-7' : 'px-2.5 text-label font-medium'
            } ${on ? selected : idle}`}
          >
            {icon ?? label}
          </button>
        );
      })}
    </div>
  );
}
