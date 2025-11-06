import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, getLiquidGlassTokens } from '../../theme';

interface LiquidGlassSurfaceProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padding?: number;
  borderRadius?: number;
  elevation?: number;
}

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  children,
  style,
  contentStyle,
  padding = spacing[4],
  borderRadius: radiusProp,
  elevation,
}) => {
  const { effectiveMode } = useTheme();
  const tokens = getLiquidGlassTokens(effectiveMode);
  const radius = radiusProp ?? borderRadius.xl;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius,
          shadowColor: tokens.shadowColor as string,
          shadowOpacity: tokens.shadowOpacity,
          shadowRadius: tokens.shadowRadius,
          shadowOffset: tokens.shadowOffset,
          elevation: elevation ?? 8,
        },
        style,
      ]}
    >
      <BlurView
        intensity={tokens.blurIntensity}
        tint={effectiveMode}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={tokens.surfaceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={tokens.specularGradient}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: tokens.borderColor,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tokens.outlineColor,
          },
        ]}
      />
      <View
        style={[
          styles.inner,
          {
            borderRadius: Math.max(radius - 2, 0),
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            padding,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  inner: {
    flexGrow: 1,
  },
});
