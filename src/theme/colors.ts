/**
 * Modern Color System
 * Inspired by iOS design with support for glass morphism effects
 */

export const colors = {
  // Primary brand colors - Modern blue gradient
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3', // Main brand color
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Neutral grays - for text and backgrounds
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    150: '#F0F0F0',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  // Semantic colors
  success: {
    light: '#81C784',
    main: '#4CAF50',
    dark: '#388E3C',
  },

  error: {
    light: '#E57373',
    main: '#F44336',
    dark: '#D32F2F',
  },

  warning: {
    light: '#FFB74D',
    main: '#FF9800',
    dark: '#F57C00',
  },

  info: {
    light: '#64B5F6',
    main: '#2196F3',
    dark: '#1976D2',
  },

  // Social interaction colors
  social: {
    like: '#FF6B9D',
    love: '#FF4757',
    celebrate: '#FFA502',
    laugh: '#FFC312',
    comment: '#5F27CD',
  },

  // Glass morphism overlay colors (with transparency)
  glass: {
    light: 'rgba(255, 255, 255, 0.7)',
    lighter: 'rgba(255, 255, 255, 0.5)',
    lightest: 'rgba(255, 255, 255, 0.3)',
    dark: 'rgba(0, 0, 0, 0.1)',
    darker: 'rgba(0, 0, 0, 0.2)',
    darkest: 'rgba(0, 0, 0, 0.3)',
  },

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#F0F2F5',
    elevated: '#FFFFFF',
  },

  // Text colors
  text: {
    primary: '#1C1C1E',
    secondary: '#6B6B6B',
    tertiary: '#999999',
    disabled: '#C7C7CC',
    inverse: '#FFFFFF',
    link: '#2196F3',
  },

  // Border colors
  border: {
    light: '#F0F0F0',
    main: '#E0E0E0',
    dark: '#BDBDBD',
    focus: '#2196F3',
  },

  // Overlay colors
  overlay: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.3)',
    dark: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ColorPalette = typeof colors;
