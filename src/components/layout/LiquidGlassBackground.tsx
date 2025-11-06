import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, getLiquidGlassTokens } from '../../theme';

interface LiquidGlassBackgroundProps extends ViewProps {
  children: React.ReactNode;
}

export const LiquidGlassBackground: React.FC<LiquidGlassBackgroundProps> = ({
  children,
  style,
  ...rest
}) => {
  const { effectiveMode } = useTheme();
  const tokens = getLiquidGlassTokens(effectiveMode);

  return (
    <View style={[styles.container, style]} {...rest}>
      <LinearGradient
        colors={tokens.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={tokens.highlightGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: tokens.highlightOpacity }]}
      />
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: tokens.backdropColor }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
