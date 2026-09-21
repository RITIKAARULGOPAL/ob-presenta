'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  readThemeState,
  SERVER_THEME_STATE,
  setThemeChoice,
  splitThemeState,
  subscribeToTheme,
  type ThemeChoice,
} from '@/lib/theme';
import { IconMonitor, IconMoon, IconSun } from './icons';

const OPTIONS: { key: ThemeChoice; label: string; Icon: typeof IconSun }[] = [
  { key: 'light', label: 'Light', Icon: IconSun },
  { key: 'system', label: 'System', Icon: IconMonitor },
  { key: 'dark', label: 'Dark', Icon: IconMoon },
];

/** Light / System / Dark as one segmented control — three states need three
 *  targets, since a two-way switch can't say "follow the OS" and a cycling
 *  button makes you guess what the next press gives you.
 *
 *  The theme is read as an external store (localStorage plus the OS media
 *  query, see src/lib/theme.ts) rather than held as state here, so the OS
 *  flipping and another tab switching both land without this component
 *  owning a copy that can go stale.
 *
 *  `tone` picks the surface it sits on: the editor's panels ('chrome') or the
 *  home screen's brand backdrop ('hero'), which is translucent over a
 *  gradient in dark mode and a plain card in light. */
export function ThemeToggle({ tone = 'chrome', className = '' }: { tone?: 'chrome' | 'hero'; className?: string }) {
  const state = useSyncExternalStore(subscribeToTheme, readThemeState, () => SERVER_THEME_STATE);
  const [choice, theme] = splitThemeState(state);

  // The attribute is already right when this first runs — THEME_INIT_SCRIPT
  // set it in <head>. This keeps it right afterwards, and it is a layout
  // effect rather than a plain one because it has to land before the browser
  // paints: in dev, Strict Mode's extra remount resets <html> to the
  // attributes React itself manages, wiping the script's, and a useEffect
  // would put it back only after a frame of the wrong theme.
  useLayoutEffect(() => applyTheme(theme), [theme]);

  const shell = tone === 'hero' ? 'border-hero-line bg-hero-card' : 'border-ui-line bg-ui-raised';
  const idle = tone === 'hero' ? 'text-hero-ink-3 hover:text-hero-ink' : 'text-ui-ink-3 hover:text-ui-ink';
  const selected =
    tone === 'hero' ? 'bg-hero-card-hover text-hero-ink shadow-card' : 'bg-ui-surface text-ui-accent shadow-card';

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 ${shell} ${className}`}
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const on = choice === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setThemeChoice(key)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${on ? selected : idle}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
