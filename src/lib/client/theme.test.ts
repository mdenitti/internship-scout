import { describe, expect, it } from 'vitest';

import { isTheme, otherTheme, resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme';

describe('isTheme', () => {
  it('accepts only the two known themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('prefers an explicit stored choice over the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system when nothing valid is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('nonsense', true)).toBe('dark');
  });
});

describe('otherTheme', () => {
  it('flips the theme', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('is wrapped in try/catch so a storage failure cannot break the page', () => {
    expect(THEME_INIT_SCRIPT.startsWith('(function(){try{')).toBe(true);
    expect(THEME_INIT_SCRIPT.endsWith('}catch(e){}})();')).toBe(true);
  });

  it('reads the same storage key and toggles the same class as the module', () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify('dark'));
    expect(THEME_INIT_SCRIPT).toContain('prefers-color-scheme: dark');
  });

  it('treats a stored "light" as authoritative over the system preference', () => {
    // `s!=='light'` must be present, otherwise a stored light theme is overridden by the OS.
    expect(THEME_INIT_SCRIPT).toContain("s!=='light'");
  });
});