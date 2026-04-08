'use client';

import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  toggle: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pulse-theme', next);
      }
      return { theme: next };
    }),
  set: (t) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('pulse-theme', t);
    }
    return set({ theme: t });
  },
}));
