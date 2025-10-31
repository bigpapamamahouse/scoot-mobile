import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { gradientColors } from '../../theme/colors';

type ModernScreenProps = {
  children: React.ReactNode;
  edges?: Readonly<Edge[]>;
  style?: StyleProp<ViewStyle>;
};

export function ModernScreen({ children, edges = ['top', 'left', 'right'], style }: ModernScreenProps) {
  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});

