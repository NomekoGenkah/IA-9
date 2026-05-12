export const DEFAULTS = {
  nodeSpacing: 80,   // minimum gap between node edges in px
  nodeSize: 68,      // node width in px
  edgeOpacity: 0.7,
  panDuration: 450,  // smooth-pan animation ms
  accentId: 'blue',
};

export const ACCENT_PRESETS = [
  { id: 'blue',   label: 'Blue',   dark: '#388bfd', light: '#0969da' },
  { id: 'green',  label: 'Green',  dark: '#3fb950', light: '#1a7f37' },
  { id: 'purple', label: 'Purple', dark: '#bc8cff', light: '#8250df' },
  { id: 'orange', label: 'Orange', dark: '#f0883e', light: '#bc4c00' },
  { id: 'cyan',   label: 'Cyan',   dark: '#39d3f5', light: '#0597a7' },
];

export function getAccent(accentId, isDark) {
  const p = ACCENT_PRESETS.find((x) => x.id === accentId) ?? ACCENT_PRESETS[0];
  return isDark ? p.dark : p.light;
}

import { useState, useCallback } from 'react';

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ia9-settings') ?? '{}') };
    } catch {
      return { ...DEFAULTS };
    }
  });

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('ia9-settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('ia9-settings');
    setSettings({ ...DEFAULTS });
  }, []);

  return { settings, update, reset };
}
