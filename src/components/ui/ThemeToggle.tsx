'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/Button';
import {
  applyTheme,
  DARK_CLASS,
  otherTheme,
  readStoredTheme,
  resolveTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from '@/lib/client/theme';

/**
 * Light/dark switch.
 *
 * The pre-paint script in the root layout already put the right class on `<html>`, and that
 * class is the single source of truth: it is read through `useSyncExternalStore` (React owns
 * the update, so there is no `setState` inside an effect) and hydrated from the server's
 * "light" snapshot, which React then corrects without a hydration mismatch.
 */
function readServerTheme(): Theme {
  // The server has no way to know the visitor's theme; React corrects this after hydration.
  return 'light';
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeToTheme, readThemeFromDom, readServerTheme);

  // While the visitor has not chosen explicitly, keep following the operating system.
  useEffect(() => {
    if (readStoredTheme() !== null) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => applyTheme(resolveTheme(null, event.matches));
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // The label names the action ("switch to dark"), not the current state.
  const next = otherTheme(theme);

  return (
    <Button
      variant="ghost"
      onClick={() => applyTheme(next)}
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`px-2 ${className}`}
    >
      <ThemeIcon theme={theme} />
    </Button>
  );
}

function readThemeFromDom(): Theme {
  return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
}

/** Re-read on OS changes and on our own writes (applyTheme dispatches the event). */
function subscribeToTheme(onChange: () => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    query.removeEventListener('change', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

/** Moon while dark is active, sun while light is. */
function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
        />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
      />
    </svg>
  );
}