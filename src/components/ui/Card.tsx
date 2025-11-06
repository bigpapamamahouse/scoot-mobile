/**
 * Modern Card Component
 * Sleek card with glass morphism and shadow variants
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { spacing, borderRadius, shadows, useTheme } from '../../theme';
import { LiquidGlassSurface } from '../layout';

export type CardVariant = 'elevated' | 'outlined' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
}) => {
  const { colors } = useTheme();
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyle,
          backgroundColor: colors.background.elevated,
          ...shadows.base,
        };
      case 'outlined':
        return {
          ...baseStyle,
          backgroundColor: colors.background.secondary,
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      default:
        return baseStyle;
    }
  };

  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return spacing[3];
      case 'md':
        return spacing[4];
      case 'lg':
        return spacing[6];
      default:
        return spacing[4];
    }
  };

  if (variant === 'glass') {
    return (
      <LiquidGlassSurface
        style={style}
        contentStyle={{
          padding: getPadding(),
          borderRadius: borderRadius.lg,
        }}
        borderRadius={borderRadius['2xl']}
      >
        {children}
      </LiquidGlassSurface>
    );
  }

  return (
    <View style={[getCardStyle(), { padding: getPadding() }, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  // Additional styles if needed
});
