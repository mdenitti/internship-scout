/**
 * Theme selection.
 *
 * The UI is themed with CSS custom properties (see `app/globals.css`): the light palette is
 * declared once under `@theme` and the dark palette overrides the very same properties on
 * `html.dark`. No component needs to know which theme is active, so this module only has to
 * decide *which* theme is active and keep `<html>` in sync.
 *
 * Kept free of React so it can be unit tested and reused from both the toggle and the
 * pre-paint script below.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'internship-scout:theme';

/** Class the dark palette hangs off. Must match `DARK_CLASS` in globals.css. */
export const DARK_CLASS = 'dark';

/** Dispatched by `applyTheme` so `useSyncExternalStore` subscribers can re-read the DOM. */
export const THEME_CHANGE_EVENT = 'internship-scout:themechange';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** A stored choice wins; otherwise follow the operating system. Garbage values are ignored. */
export function resolveTheme(stored: unknown, prefersDark: boolean): Theme {
  return isTheme(stored) ? stored : prefersDark ? 'dark' : 'light';
}

export function readStoredTheme(): unknown {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the caller falls back to the system preference.
    return null;
  }
}

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

/** Reflect the theme onto `<html>` and persist it. Persisting is best effort. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, theme === 'dark');
  // Tells the browser to render native widgets (scrollbars, form controls) for this theme.
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The class is already applied, so the toggle still works for this page view.
  }
  // Tell any mounted toggle to re-read the class.
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export const otherTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

/**
 * Blocking script for `<head>`. It must run before the first paint, otherwise a dark-mode
 * visitor sees a flash of the light canvas. Deliberately dependency free and wrapped in
 * try/catch: a theme is never worth breaking the page over.
 *
 * Mirrors `resolveTheme` + `applyTheme`; keep the two in step.
 */
export const THEME_INIT_SCRIPT = [
  '(function(){try{',
  `var k=${JSON.stringify(THEME_STORAGE_KEY)};`,
  `var s=localStorage.getItem(k);`,
  "var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);",
  `var e=document.documentElement;`,
  `e.classList.toggle(${JSON.stringify(DARK_CLASS)},d);`,
  "e.style.colorScheme=d?'dark':'light';",
  '}catch(e){}})();',
].join('');