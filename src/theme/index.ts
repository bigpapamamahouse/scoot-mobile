/**
 * Modern Design System
 * Centralized theme for consistent styling across the app
 */

export { colors } from './colors';
export { typography } from './typography';
export { spacing, borderRadius, iconSizes } from './spacing';
export { shadows, glassEffect } from './shadows';

// Re-export types
export type { ColorPalette } from './colors';
export type { Typography } from './typography';
export type { Spacing, BorderRadius, IconSizes } from './spacing';
export type { Shadows } from './shadows';

// Combined theme object
import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, iconSizes } from './spacing';
import { shadows } from './shadows';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  iconSizes,
  shadows,
} as const;

export type Theme = typeof theme;
