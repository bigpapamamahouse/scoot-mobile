/**
 * Modern Button Component
 * Sleek, reusable button with multiple variants
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme, typography, spacing, borderRadius, shadows } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) => {
  const { colors } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[size],
      ...(fullWidth && styles.fullWidth),
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.neutral[300] : colors.primary[500],
          ...shadows.sm,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.neutral[200] : colors.neutral[100],
          borderWidth: 1,
          borderColor: colors.border.main,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? colors.neutral[300] : colors.primary[500],
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.neutral[300] : colors.error.main,
          ...shadows.sm,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      ...typography.styles.button,
      fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
    };

    switch (variant) {
      case 'primary':
      case 'danger':
        return {
          ...baseTextStyle,
          color: colors.text.inverse,
        };
      case 'secondary':
        return {
          ...baseTextStyle,
          color: colors.text.primary,
        };
      case 'outline':
      case 'ghost':
        return {
          ...baseTextStyle,
          color: disabled ? colors.text.disabled : colors.primary[500],
        };
      default:
        return baseTextStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.text.inverse : colors.primary[500]}
          size="small"
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.base,
    flexDirection: 'row',
  },
  sm: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: 36,
  },
  md: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  lg: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    minHeight: 52,
  },
  fullWidth: {
    width: '100%',
  },
});
