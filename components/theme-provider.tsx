"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GlassPopover } from '@/components/glass-popover';
import {
  Check,
  Moon,
  Monitor,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type BackgroundStyle = 'aurora' | 'subtle' | 'solid';

export interface ThemeConfig {
  mode: ThemeMode;
  accent: string;
  background: BackgroundStyle;
  intensity: number;
}

export const PRESET_ACCENTS = [
  { name: 'Soft Sage', value: '#b9cf9f' },
  { name: 'Forest', value: '#2d6a4f' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Warm Amber', value: '#d9824a' },
  { name: 'Cyan', value: '#22d3ee' },
] as const;

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  accent: '#b9cf9f',
  background: 'aurora',
  intensity: 50,
};

const STORAGE_KEY = 'sgb-theme';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const n = parseInt(clean, 16);
  if (isNaN(n)) return { r: 99, g: 102, b: 241 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function applyThemeTokens(config: ThemeConfig) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  // 1. Resolve Mode
  let resolvedMode: 'dark' | 'light' = 'dark';
  if (config.mode === 'system') {
    resolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    resolvedMode = config.mode;
  }
  root.setAttribute('data-theme', resolvedMode);

  // 2. Compute accent colors
  const rgb = hexToRgb(config.accent);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  root.style.setProperty('--accent-solid', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
  const isLightAccent = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 140;
  root.style.setProperty('--on-accent', isLightAccent ? '#060708' : '#ffffff');
  root.style.setProperty('--accent', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`);
  root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
  root.style.setProperty('--accent-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)`);
  root.style.setProperty('--accent-glow', `0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);

  // 3. Blob colors & opacity
  let blobOpacity = 1;
  if (config.background === 'subtle') blobOpacity = 0.35;
  if (config.background === 'solid') blobOpacity = 0;
  root.style.setProperty('--blob-opacity', String(blobOpacity));

  if (resolvedMode === 'dark') {
    root.style.setProperty('--bg-base', '#060708');
    root.style.setProperty('--text-1', 'rgba(255, 255, 255, 0.92)');
    root.style.setProperty('--text-2', 'rgba(255, 255, 255, 0.58)');
    root.style.setProperty('--text-3', 'rgba(255, 255, 255, 0.36)');
  } else {
    root.style.setProperty('--bg-base', '#f7f8f4');
    root.style.setProperty('--text-1', 'rgba(15, 20, 16, 0.92)');
    root.style.setProperty('--text-2', 'rgba(15, 20, 16, 0.60)');
    root.style.setProperty('--text-3', 'rgba(15, 20, 16, 0.38)');
  }

  // 4. Glass intensity
  const normIntensity = Math.max(0, Math.min(100, config.intensity));
  if (resolvedMode === 'dark') {
    const high = (0.04 + (normIntensity / 100) * 0.10).toFixed(3);
    const low = (0.01 + (normIntensity / 100) * 0.04).toFixed(3);
    root.style.setProperty('--glass-opacity-high', high);
    root.style.setProperty('--glass-opacity-low', low);
  } else {
    const high = (0.50 + (normIntensity / 100) * 0.30).toFixed(3);
    const low = (0.35 + (normIntensity / 100) * 0.25).toFixed(3);
    root.style.setProperty('--glass-opacity-high', high);
    root.style.setProperty('--glass-opacity-low', low);
  }
  const blurPx = Math.round(8 + (normIntensity / 100) * 28);
  root.style.setProperty('--glass-blur', `${blurPx}px`);
}

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (updater: Partial<ThemeConfig> | ((prev: ThemeConfig) => ThemeConfig)) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  resetTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = DEFAULT_THEME;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setThemeState(initial);
    applyThemeTokens(initial);
    setMounted(true);
  }, []);

  const setTheme = useCallback(
    (updater: Partial<ThemeConfig> | ((prev: ThemeConfig) => ThemeConfig)) => {
      setThemeState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {}
        applyThemeTokens(next);
        return next;
      });
    },
    [],
  );

  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME);
  }, [setTheme]);

  useEffect(() => {
    if (!mounted || theme.mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeTokens(theme);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mounted, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeSettingsPopover({
  isOpen,
  onClose,
  anchorEl,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const { theme, setTheme, resetTheme } = useTheme();

  return (
    <GlassPopover
      isOpen={isOpen}
      onClose={onClose}
      anchorEl={anchorEl}
      width={320}
      id="theme-settings-popover"
      className="p-4 text-xs select-none"
    >
      {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] border border-[var(--accent-border)] text-white shadow-sm">
              <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-[var(--text-1)]">Theme & Appearance</h3>
              <p className="text-[10px] text-[var(--text-2)] font-normal">Personalize console aesthetics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-2)] hover:bg-white/[0.08] hover:text-[var(--text-1)] transition"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Mode: Dark / Light / System */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-2)] mb-2">
              Color Mode
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl p-1 bg-white/[0.04] border border-white/[0.06]">
              {(
                [
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme({ mode: id })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-normal transition ${
                    theme.mode === id
                      ? 'bg-[var(--accent)] text-white border border-[var(--accent-border)] shadow-sm font-medium'
                      : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color: 6 presets + Custom */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-2)] mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_ACCENTS.map((preset) => {
                const isSelected = theme.accent.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    onClick={() => setTheme({ accent: preset.value })}
                    title={preset.name}
                    style={{ backgroundColor: preset.value }}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1326]' : ''
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />}
                  </button>
                );
              })}

              {/* Custom native color picker */}
              <label
                title="Custom color"
                className="relative h-7 w-7 rounded-full border border-white/30 flex items-center justify-center cursor-pointer overflow-hidden transition-transform hover:scale-105"
                style={{ backgroundColor: theme.accent }}
              >
                <input
                  type="color"
                  value={theme.accent}
                  onChange={(e) => setTheme({ accent: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span className="text-[10px] text-white drop-shadow font-bold">+</span>
              </label>
            </div>
          </div>

          {/* Background Style: Aurora / Subtle / Solid */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-2)] mb-2">
              Background Style
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl p-1 bg-white/[0.04] border border-white/[0.06]">
              {(
                [
                  { id: 'aurora', label: 'Aurora' },
                  { id: 'subtle', label: 'Subtle' },
                  { id: 'solid', label: 'Solid' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTheme({ background: id })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-normal transition text-center ${
                    theme.background === id
                      ? 'bg-[var(--accent)] text-white border border-[var(--accent-border)] shadow-sm font-medium'
                      : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Glass Intensity Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-2)] mb-2">
              <span>Glass Intensity</span>
              <span className="num-tabular text-[var(--text-1)] font-normal">{theme.intensity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={theme.intensity}
              onChange={(e) => setTheme({ intensity: Number(e.target.value) })}
              className="w-full accent-[var(--accent-solid)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-3)] mt-1 font-normal">
              <span>Crisp</span>
              <span>Balanced</span>
              <span>Ultra Glass</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 mt-4">
          <button
            onClick={resetTheme}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-2)] hover:text-[var(--text-1)] transition font-normal"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
            <span>Reset to default</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md text-[var(--on-accent)] bg-[var(--accent-solid)] hover:opacity-90 transition shadow-sm"
          >
            Done
          </button>
        </div>
    </GlassPopover>
  );
}

