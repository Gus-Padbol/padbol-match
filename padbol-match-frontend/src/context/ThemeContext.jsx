import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export const PADBOL_THEME_STORAGE_KEY = 'padbol_theme';

/** Misma preferencia que `padbol_theme` (hub / panel admin / script en index.html). */
export const THEME_PUBLIC_STORAGE_KEY = 'theme';

function readStoredThemePreference() {
  if (typeof window === 'undefined') return null;
  try {
    const primary = localStorage.getItem(PADBOL_THEME_STORAGE_KEY);
    if (primary === 'dark' || primary === 'light') return primary;
    const mirror = localStorage.getItem(THEME_PUBLIC_STORAGE_KEY);
    if (mirror === 'dark' || mirror === 'light') return mirror;
  } catch {
    /* ignore */
  }
  return null;
}

function readInitialTheme() {
  const stored = readStoredThemePreference();
  if (stored) return stored;
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function persistThemeKeys(normalized) {
  try {
    localStorage.setItem(PADBOL_THEME_STORAGE_KEY, normalized);
    localStorage.setItem(THEME_PUBLIC_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

function applyThemeClassToDocument(theme) {
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-light');
  root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F8F9FA');
    }
  } catch {
    /* ignore */
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const normalized = resolved === 'dark' ? 'dark' : 'light';
      persistThemeKeys(normalized);
      return normalized;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  useLayoutEffect(() => {
    applyThemeClassToDocument(theme);
  }, [theme]);

  /** Alinea ambas claves si solo existía una; otra pestaña del navegador vía `storage`. */
  useEffect(() => {
    persistThemeKeys(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== PADBOL_THEME_STORAGE_KEY && e.key !== THEME_PUBLIC_STORAGE_KEY) return;
      const v = e.newValue;
      if (v !== 'dark' && v !== 'light') return;
      setThemeState(v);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === 'dark',
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
}

/** Switch reutilizable (Mi Perfil, popover del hub). */
export function ThemeDarkModeSwitch({ id, disabled = false }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      {...(id ? { id } : {})}
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Modo oscuro"
      disabled={disabled}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      style={{
        width: 50,
        height: 30,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: isDark ? 'var(--accent)' : 'var(--border)',
        position: 'relative',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        boxSizing: 'border-box',
        transition: 'background 0.2s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: isDark ? 22 : 4,
          top: 4,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg-card)',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}
