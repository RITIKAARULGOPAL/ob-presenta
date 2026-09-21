/** Light/dark for the app's own chrome (see the token block at the top of
 *  globals.css). Deliberately framework-free — no React, no DOM access at
 *  import time — because layout.tsx is a server component and needs
 *  THEME_INIT_SCRIPT from here without pulling a client module into the
 *  server graph.
 *
 *  The current theme is external state, not React state: it lives in
 *  localStorage, it can change from the OS, and it can change in another tab.
 *  So this file is shaped as a store to subscribe to (see subscribeToTheme /
 *  readThemeState) rather than something a component owns. */

/** What the user picked. 'system' defers to the OS and keeps following it. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** What that choice resolves to right now — the only two values that ever
 *  reach the `data-theme` attribute. */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'presenta-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** What mobile browsers paint their own chrome (status bar, address bar) with,
 *  per theme. Next's `viewport.themeColor` can emit these as static <meta>
 *  tags, but only keyed on prefers-color-scheme — which is the OS, not the
 *  choice made here, so it would show the wrong colour for anyone who has
 *  overridden their OS. Driving the tag from applyTheme() instead keeps it
 *  honest.
 *
 *  These mirror --app-bg in globals.css. Reading the computed value instead
 *  would avoid the duplication, but THEME_INIT_SCRIPT has to run before the
 *  stylesheet is guaranteed to be parsed, so the two literals earn their
 *  keep — change them together. */
const THEME_COLOR: Record<Theme, string> = { light: '#f1f5f9', dark: '#0b1119' };

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    // Private mode, or storage blocked. Following the OS is the right thing
    // to fall back to: the app stays usable, it just won't remember.
    return 'system';
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveChoice(choice: ThemeChoice): Theme {
  return choice === 'system' ? systemTheme() : choice;
}

/** The store's snapshot, as one string ("system:dark") so that
 *  useSyncExternalStore can compare it by value.
 *
 *  Both halves have to be in it. The choice alone would not change when the
 *  OS flips under 'system', and the resolved theme alone would not tell the
 *  toggle which of its three buttons is the one that was picked. */
export type ThemeState = `${ThemeChoice}:${Theme}`;

export function readThemeState(): ThemeState {
  const choice = readStoredChoice();
  return `${choice}:${resolveChoice(choice)}`;
}

/** Nothing about the visitor is knowable while rendering on the server, and
 *  it matches the `data-theme` layout.tsx renders. The inline script has
 *  already corrected the page by the time anyone sees it; this only decides
 *  which button the toggle draws as selected for that first frame. */
export const SERVER_THEME_STATE: ThemeState = 'system:light';

export function splitThemeState(state: ThemeState): [ThemeChoice, Theme] {
  return state.split(':') as [ThemeChoice, Theme];
}

const listeners = new Set<() => void>();

/** Subscribe to every way the answer can change: this tab picking one, the OS
 *  flipping while the choice is 'system', and another tab picking one. */
export function subscribeToTheme(onChange: () => void): () => void {
  listeners.add(onChange);

  const media = matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange();
  };
  addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onChange);
    removeEventListener('storage', onStorage);
  };
}

/** Persist a choice and tell this tab's subscribers. (The `storage` event
 *  above only fires in OTHER tabs, which is why the notification is manual.) */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* see readStoredChoice — the switch still applies, it just won't stick */
  }
  for (const listener of listeners) listener();
}

/** The single place the attribute is written. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLOR[theme]);
}

/** Runs blocking in <head>, before the first paint, so a dark-mode visitor
 *  never sees a white flash of the server-rendered (themeless) HTML. It is
 *  the logic above, inlined, because it has to run before any bundle loads.
 *
 *  Kept next to that logic on purpose — the storage key and the attribute
 *  name are shared, and the two drifting apart is exactly the bug this file
 *  is arranged to prevent. */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(c!=='light'&&c!=='dark')c=matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?'dark':'light';document.documentElement.dataset.theme=c;var m=document.createElement('meta');m.name='theme-color';m.content=${JSON.stringify(
  THEME_COLOR,
)}[c];document.head.appendChild(m);}catch(e){document.documentElement.dataset.theme='light';}})();`;
