import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

declare global {
  interface Window {
    spaceExplorer?: {
      getTheme: () => Promise<Theme | null>;
      setTheme: (theme: Theme) => Promise<void>;
    };
  }
}

function isTheme(value: string | null): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function useTheme() {
  const [theme, updateTheme] = useState<Theme>('system');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const saved = window.spaceExplorer ? await window.spaceExplorer.getTheme() : localStorage.getItem('space-explorer-theme');
        if (saved !== null && !isTheme(saved)) throw new Error('Invalid saved theme');
        if (active && saved !== null) updateTheme(saved);
      } catch (err) {
        if (active) setError(`Could not load theme preference: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  function setTheme(value: Theme) {
    updateTheme(value);
    setError('');
    async function save() {
      try {
        if (window.spaceExplorer) await window.spaceExplorer.setTheme(value);
        else localStorage.setItem('space-explorer-theme', value);
      } catch (err) {
        setError(`Could not save theme preference: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    void save();
  }
  return { theme, setTheme, ready, error };
}
