/**
 * Modern Badge Component
 * For notification counts and status indicators
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

export type BadgeVariant = 'primary' | 'success' | 'error' | 'warning' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  count?: number;
  text?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  count,
  text,
  variant = 'primary',
  size = 'md',
  dot = false,
  style,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary[500];
      case 'success':
        return colors.success.main;
      case 'error':
        return colors.error.main;
      case 'warning':
        return colors.warning.main;
      case 'neutral':
        return colors.neutral[600];
      default:
        return colors.primary[500];
    }
  };

  const getSizeStyle = (): ViewStyle => {
    if (dot) {
      return {
        width: size === 'sm' ? 8 : size === 'md' ? 10 : 12,
        height: size === 'sm' ? 8 : size === 'md' ? 10 : 12,
        borderRadius: borderRadius.full,
      };
    }

    return {
      minWidth: size === 'sm' ? 18 : size === 'md' ? 20 : 24,
      height: size === 'sm' ? 18 : size === 'md' ? 20 : 24,
      paddingHorizontal: spacing[1],
      borderRadius: borderRadius.full,
    };
  };

  const getTextStyle = (): TextStyle => {
    return {
      fontSize: size === 'sm' ? 10 : size === 'md' ? 12 : 14,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.inverse,
    };
  };

  const displayText = text || (count !== undefined ? (count > 99 ? '99+' : count.toString()) : '');

  if (dot) {
    return (
      <View
        style={[
          getSizeStyle(),
          { backgroundColor: getBackgroundColor() },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        getSizeStyle(),
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      <Text style={getTextStyle()}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
