import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, borderRadius, shadows } from '../../theme';

export type LiquidGlassVariant = 'regular' | 'clear';

interface LiquidGlassSurfaceProps extends ViewProps {
  variant?: LiquidGlassVariant;
  borderRadiusOverride?: number;
  withShadow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared wrapper that mimics Apple’s Liquid Glass material.
 * Applies a blurred background, adaptive tint, and subtle gradient highlights.
 */
export function LiquidGlassSurface({
  children,
  variant = 'regular',
  borderRadiusOverride,
  withShadow = false,
  style,
  ...rest
}: LiquidGlassSurfaceProps) {
  const { colors, effectiveMode } = useTheme();
  const resolvedRadius = borderRadiusOverride ?? borderRadius.lg;

  const gradientColors = React.useMemo<[string, string]>(() => {
    if (variant === 'clear') {
      return effectiveMode === 'dark'
        ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
        : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.15)'];
    }
    return effectiveMode === 'dark'
      ? ['rgba(10,10,12,0.55)', 'rgba(10,10,12,0.35)']
      : ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.55)'];
  }, [effectiveMode, variant]);

  const borderColor = variant === 'clear'
    ? colors.glass.borderClear
    : colors.glass.border;

  const blurIntensity = variant === 'clear' ? 35 : 70;

  return (
    <View
      {...rest}
      style={[
        styles.container,
        { borderRadius: resolvedRadius },
        withShadow ? shadows.base : null,
        style,
      ]}
    >
      <BlurView
        tint={effectiveMode === 'dark' ? 'dark' : 'light'}
        intensity={blurIntensity}
        style={[StyleSheet.absoluteFill, { borderRadius: resolvedRadius }]}
      />
      <LinearGradient
        colors={gradientColors}
        style={[StyleSheet.absoluteFill, { borderRadius: resolvedRadius }]}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: resolvedRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor,
          },
        ]}
      />
      <View style={[styles.content, { borderRadius: resolvedRadius }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    overflow: 'hidden',
  },
});
