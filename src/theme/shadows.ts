/**
 * Shadow and Elevation System
 * Modern shadows for depth and hierarchy
 */

import { ViewStyle } from 'react-native';

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Small shadows
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // Medium shadows
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },

  // Large shadows
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 15,
  },

  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 20,
  },

  // Colored shadows for interactive elements
  colored: {
    primary: {
      shadowColor: '#2196F3',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    success: {
      shadowColor: '#4CAF50',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    error: {
      shadowColor: '#F44336',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
  },
} as const;

/**
 * Glass morphism style
 * Creates a frosted glass effect with blur and transparency
 */
export const glassEffect: ViewStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
};

export type Shadows = typeof shadows;
