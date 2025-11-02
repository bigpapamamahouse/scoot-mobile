/**
 * Spacing and Layout System
 * Consistent spacing scale for margins, padding, and gaps
 */

export const spacing = {
  // Base spacing scale (multiplied by 4)
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  base: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  full: 9999,
} as const;

export const iconSizes = {
  xs: 16,
  sm: 20,
  base: 24,
  md: 28,
  lg: 32,
  xl: 40,
  '2xl': 48,
  '3xl': 64,
} as const;

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type IconSizes = typeof iconSizes;
