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
import { SegmentedControl, type SegmentOption } from './ui/SegmentedControl';
import { IconMonitor, IconMoon, IconSun } from './icons';

const OPTIONS: SegmentOption<ThemeChoice>[] = [
  { key: 'light', label: 'Light theme', icon: <IconSun className="h-3.5 w-3.5" /> },
  { key: 'system', label: 'System theme', icon: <IconMonitor className="h-3.5 w-3.5" /> },
  { key: 'dark', label: 'Dark theme', icon: <IconMoon className="h-3.5 w-3.5" /> },
];

/** Light / System / Dark. Three states need three targets: a two-way switch
 *  cannot say "follow the OS", and a cycling button makes you guess what the
 *  next press gives you.
 *
 *  The theme is read as an external store (localStorage plus the OS media
 *  query, see src/lib/theme.ts) rather than held as state here, so the OS
 *  flipping and another tab switching both land without this component
 *  owning a copy that can go stale. */
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

  return (
    <SegmentedControl
      options={OPTIONS}
      value={choice}
      onChange={setThemeChoice}
      ariaLabel="Colour theme"
      tone={tone}
      className={className}
    />
  );
}
