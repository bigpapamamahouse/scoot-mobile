import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  ViewProps,
} from 'react-native';
import { glassShadow, palette } from '../../theme/colors';

type GlassCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'default' | 'light' | 'dark';
} & ViewProps;

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 55,
  tint = 'dark',
  ...rest
}: GlassCardProps) {
  return (
    <View style={[styles.wrapper, style]} {...rest}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(148, 163, 184, 0.35)', 'rgba(15, 23, 42, 0.25)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.backgroundSoft,
    ...glassShadow,
  },
  content: {
    padding: 20,
  },
});

