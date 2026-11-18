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
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
] as const;

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  accent: '#6366f1',
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
    root.style.setProperty('--blob-1', `hsla(${hsl.h}, ${Math.max(65, hsl.s)}%, ${Math.min(60, Math.max(45, hsl.l))}%, 0.45)`);
    root.style.setProperty('--blob-2', `hsla(${(hsl.h + 40) % 360}, ${Math.max(65, hsl.s)}%, ${Math.min(60, Math.max(45, hsl.l))}%, 0.38)`);
    root.style.setProperty('--blob-3', `hsla(${(hsl.h + 170) % 360}, ${Math.max(65, hsl.s)}%, ${Math.min(60, Math.max(45, hsl.l))}%, 0.30)`);
    root.style.setProperty('--blob-4', `hsla(${(hsl.h + 290) % 360}, ${Math.max(65, hsl.s)}%, ${Math.min(60, Math.max(45, hsl.l))}%, 0.20)`);
  } else {
    root.style.setProperty('--blob-1', `hsla(${hsl.h}, ${Math.max(50, hsl.s)}%, 72%, 0.35)`);
    root.style.setProperty('--blob-2', `hsla(${(hsl.h + 40) % 360}, ${Math.max(50, hsl.s)}%, 75%, 0.28)`);
    root.style.setProperty('--blob-3', `hsla(${(hsl.h + 170) % 360}, ${Math.max(50, hsl.s)}%, 78%, 0.25)`);
    root.style.setProperty('--blob-4', `hsla(${(hsl.h + 290) % 360}, ${Math.max(50, hsl.s)}%, 80%, 0.20)`);
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
    let initial = DEFAULT_THEME;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        initial = { ...DEFAULT_THEME, ...JSON.parse(stored) };
      }
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
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 60, left: 20 });

  useEffect(() => {
    if (!isOpen || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 440;

    let left = rect.left;
    if (typeof window !== 'undefined') {
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
    }

    let top = rect.bottom + 8;
    if (typeof window !== 'undefined') {
      if (top + popoverHeight > window.innerHeight - 16 && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 8;
      }
    }

    setPos({ top, left });
  }, [isOpen, anchorEl]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Invisible backdrop layer with slight table dimming */}
      <div
        className="fixed inset-0 z-[9998] bg-black/15 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: '320px',
          zIndex: 9999,
        }}
        className="glass-popover p-4 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
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
            className="glass-btn-primary px-3 py-1 text-xs font-medium text-white shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

