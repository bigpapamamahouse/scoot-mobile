/**
 * Modern Card Component
 * Sleek card with glass morphism and shadow variants
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

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
          backgroundColor: colors.background.elevated,
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      case 'glass':
        return {
          ...baseStyle,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          ...shadows.sm,
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

  return (
    <View style={[getCardStyle(), { padding: getPadding() }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // Additional styles if needed
});
