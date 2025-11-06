import { ColorValue } from 'react-native';

export type LiquidGlassTokens = {
  backgroundGradient: string[];
  highlightGradient: string[];
  highlightOpacity: number;
  backdropColor: string;
  surfaceGradient: string[];
  specularGradient: string[];
  borderColor: string;
  outlineColor: string;
  shadowColor: ColorValue;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  blurIntensity: number;
  innerGlowColor: string;
  accentGlow: string;
};

const palettes: Record<'light' | 'dark', LiquidGlassTokens> = {
  light: {
    backgroundGradient: ['#F8FBFF', '#F1F5FF', '#F7F2FF'],
    highlightGradient: ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.1)'],
    highlightOpacity: 0.85,
    backdropColor: 'rgba(246, 248, 255, 0.35)',
    surfaceGradient: ['rgba(255, 255, 255, 0.78)', 'rgba(240, 246, 255, 0.58)'],
    specularGradient: ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0)'],
    borderColor: 'rgba(255, 255, 255, 0.55)',
    outlineColor: 'rgba(142, 170, 255, 0.28)',
    shadowColor: 'rgba(15, 23, 42, 0.25)',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    blurIntensity: 36,
    innerGlowColor: 'rgba(255, 255, 255, 0.18)',
    accentGlow: 'rgba(56, 189, 248, 0.2)',
  },
  dark: {
    backgroundGradient: ['#020617', '#0F172A', '#1E293B'],
    highlightGradient: ['rgba(94, 234, 212, 0.22)', 'rgba(59, 130, 246, 0.12)'],
    highlightOpacity: 0.65,
    backdropColor: 'rgba(2, 6, 23, 0.55)',
    surfaceGradient: ['rgba(15, 23, 42, 0.72)', 'rgba(30, 41, 59, 0.56)'],
    specularGradient: ['rgba(148, 163, 184, 0.45)', 'rgba(15, 23, 42, 0)'],
    borderColor: 'rgba(226, 232, 240, 0.18)',
    outlineColor: 'rgba(59, 130, 246, 0.25)',
    shadowColor: 'rgba(2, 6, 23, 0.7)',
    shadowOpacity: 0.45,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 28 },
    blurIntensity: 52,
    innerGlowColor: 'rgba(148, 163, 184, 0.14)',
    accentGlow: 'rgba(56, 189, 248, 0.28)',
  },
};

export const getLiquidGlassTokens = (mode: 'light' | 'dark'): LiquidGlassTokens => palettes[mode];
