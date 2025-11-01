/**
 * Modern Color System
 * Inspired by iOS design with support for glass morphism effects and dark mode
 */

export const lightColors = {
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

export const darkColors = {
  // Primary brand colors - Slightly brighter for dark mode
  primary: {
    50: '#0D47A1',
    100: '#1565C0',
    200: '#1976D2',
    300: '#1E88E5',
    400: '#2196F3',
    500: '#42A5F5', // Main brand color in dark mode
    600: '#64B5F6',
    700: '#90CAF9',
    800: '#BBDEFB',
    900: '#E3F2FD',
  },

  // Neutral grays - inverted for dark mode
  neutral: {
    0: '#000000',
    50: '#0A0A0A',
    100: '#1A1A1A',
    150: '#1F1F1F',
    200: '#2A2A2A',
    300: '#3A3A3A',
    400: '#525252',
    500: '#6B6B6B',
    600: '#9E9E9E',
    700: '#B0B0B0',
    800: '#D4D4D4',
    900: '#E5E5E5',
    1000: '#FFFFFF',
  },

  // Semantic colors - slightly brighter for dark mode
  success: {
    light: '#388E3C',
    main: '#66BB6A',
    dark: '#81C784',
  },

  error: {
    light: '#D32F2F',
    main: '#EF5350',
    dark: '#E57373',
  },

  warning: {
    light: '#F57C00',
    main: '#FFA726',
    dark: '#FFB74D',
  },

  info: {
    light: '#1976D2',
    main: '#42A5F5',
    dark: '#64B5F6',
  },

  // Social interaction colors - same as light mode
  social: {
    like: '#FF6B9D',
    love: '#FF4757',
    celebrate: '#FFA502',
    laugh: '#FFC312',
    comment: '#8E44AD',
  },

  // Glass morphism overlay colors for dark mode
  glass: {
    light: 'rgba(30, 30, 30, 0.7)',
    lighter: 'rgba(30, 30, 30, 0.5)',
    lightest: 'rgba(30, 30, 30, 0.3)',
    dark: 'rgba(255, 255, 255, 0.1)',
    darker: 'rgba(255, 255, 255, 0.2)',
    darkest: 'rgba(255, 255, 255, 0.3)',
  },

  // Background colors - dark theme
  background: {
    primary: '#000000',
    secondary: '#0A0A0A',
    tertiary: '#1A1A1A',
    elevated: '#1F1F1F',
  },

  // Text colors - light text on dark backgrounds
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    tertiary: '#787878',
    disabled: '#4A4A4A',
    inverse: '#000000',
    link: '#42A5F5',
  },

  // Border colors - lighter borders for dark mode
  border: {
    light: '#2A2A2A',
    main: '#3A3A3A',
    dark: '#525252',
    focus: '#42A5F5',
  },

  // Overlay colors - lighter overlays for dark mode
  overlay: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.15)',
    dark: 'rgba(255, 255, 255, 0.3)',
  },
} as const;

// Default to light colors for backward compatibility
export const colors = lightColors;

export type ColorPalette = typeof lightColors;
