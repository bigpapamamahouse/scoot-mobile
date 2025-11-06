/**
 * Modern IconButton Component
 * Circular icon button with glass morphism support
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, borderRadius, shadows, getLiquidGlassTokens } from '../../theme';

export type IconButtonVariant = 'solid' | 'ghost' | 'glass';
export type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  badge?: number;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'ghost',
  size = 'md',
  color,
  backgroundColor,
  disabled = false,
  badge,
  style,
}) => {
  const { colors, effectiveMode } = useTheme();
  const tokens = React.useMemo(() => getLiquidGlassTokens(effectiveMode), [effectiveMode]);

  const getSize = () => {
    switch (size) {
      case 'sm':
        return { container: 32, icon: 18 };
      case 'md':
        return { container: 44, icon: 24 };
      case 'lg':
        return { container: 56, icon: 32 };
      default:
        return { container: 44, icon: 24 };
    }
  };

  const sizes = getSize();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: sizes.container,
      height: sizes.container,
      borderRadius: sizes.container / 2,
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (variant) {
      case 'solid':
        return {
          ...baseStyle,
          backgroundColor: backgroundColor || colors.primary[500],
          ...shadows.sm,
        };
      case 'glass':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tokens.outlineColor,
          ...shadows.sm,
        };
      case 'ghost':
      default:
        return {
          ...baseStyle,
          backgroundColor: backgroundColor || 'transparent',
        };
    }
  };

  const getIconColor = () => {
    if (color) return color;
    if (variant === 'solid') return colors.text.inverse;
    return colors.text.primary;
  };

  const renderBackground = variant === 'glass';

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
    >
      {renderBackground && (
        <>
          <BlurView
            intensity={tokens.blurIntensity}
            tint={effectiveMode}
            style={[StyleSheet.absoluteFill, { borderRadius: sizes.container / 2 }]}
          />
          <LinearGradient
            colors={tokens.surfaceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: sizes.container / 2 }]}
          />
          <LinearGradient
            colors={tokens.specularGradient}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: sizes.container / 2 }]}
          />
        </>
      )}
      <View style={{ marginTop: -5 }}>
        <Ionicons name={icon} size={sizes.icon} color={getIconColor()} />
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error.main }]}>
          <Ionicons name="ellipse" size={8} color={colors.error.main} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: borderRadius.full,
    width: 8,
    height: 8,
  },
});
