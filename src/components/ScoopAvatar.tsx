/**
 * ScoopAvatar Component
 * Displays a user's avatar with a gradient ring indicating unviewed scoops
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { useTheme, spacing } from '../theme';

interface ScoopAvatarProps {
  avatarKey?: string | null;
  size?: number;
  hasUnviewed?: boolean;
  onPress?: () => void;
  showAddButton?: boolean;
}

export const ScoopAvatar: React.FC<ScoopAvatarProps> = ({
  avatarKey,
  size = 64,
  hasUnviewed = false,
  onPress,
  showAddButton = false,
}) => {
  const { colors } = useTheme();

  // Ring dimensions
  const ringWidth = Math.max(2, size * 0.04);
  const ringGap = Math.max(2, size * 0.03);
  const outerSize = size + (ringWidth + ringGap) * 2;

  const gradientColors = hasUnviewed
    ? ['#FF6B6B', '#FF8E53', '#FFA726', '#FFD93D'] as const // Vibrant gradient for unviewed
    : [colors.neutral[300], colors.neutral[400]] as const; // Gray for all viewed

  const content = (
    <View style={[styles.container, { width: outerSize, height: outerSize }]}>
      {/* Gradient ring */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientRing,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
          },
        ]}
      />

      {/* White/background gap between ring and avatar */}
      <View
        style={[
          styles.gap,
          {
            width: outerSize - ringWidth * 2,
            height: outerSize - ringWidth * 2,
            borderRadius: (outerSize - ringWidth * 2) / 2,
            backgroundColor: colors.background.primary,
          },
        ]}
      />

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Avatar avatarKey={avatarKey} size={size} />
      </View>

      {/* Add button indicator */}
      {showAddButton && (
        <View
          style={[
            styles.addButton,
            {
              backgroundColor: colors.primary[500],
              borderColor: colors.background.primary,
            },
          ]}
        >
          <View style={styles.addIcon}>
            <View style={[styles.addLine, styles.addLineHorizontal, { backgroundColor: colors.text.inverse }]} />
            <View style={[styles.addLine, styles.addLineVertical, { backgroundColor: colors.text.inverse }]} />
          </View>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientRing: {
    position: 'absolute',
  },
  gap: {
    position: 'absolute',
  },
  avatarContainer: {
    position: 'absolute',
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLine: {
    position: 'absolute',
    borderRadius: 1,
  },
  addLineHorizontal: {
    width: 10,
    height: 2,
  },
  addLineVertical: {
    width: 2,
    height: 10,
  },
});

export default ScoopAvatar;
