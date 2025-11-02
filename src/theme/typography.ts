/**
 * Typography System
 * Modern type scale with proper hierarchy
 */

export const typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
  },

  // Font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tighter: -0.8,
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
  },

  // Predefined text styles
  styles: {
    // Headings
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 38,
      letterSpacing: -0.4,
    },
    h2: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 34,
      letterSpacing: -0.2,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 31,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    h5: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 25,
    },
    h6: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },

    // Body text
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    bodyLarge: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 27,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 21,
    },

    // Labels and captions
    label: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 17,
    },

    // Buttons
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 16,
      letterSpacing: 0.2,
    },
    buttonSmall: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 14,
      letterSpacing: 0.2,
    },

    // Links
    link: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 24,
      textDecorationLine: 'underline' as const,
    },
  },
} as const;

export type Typography = typeof typography;
