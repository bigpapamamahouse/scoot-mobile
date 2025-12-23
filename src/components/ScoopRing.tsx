import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { useTheme } from '../theme';

interface ScoopRingProps {
  avatarKey?: string | null;
  handle?: string;
  hasNew: boolean;
  isOwn?: boolean;
  onPress: () => void;
  size?: number;
}

export const ScoopRing = React.memo(({
  avatarKey,
  handle,
  hasNew,
  isOwn = false,
  onPress,
  size = 70,
}: ScoopRingProps) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, size), [colors, size]);

  const ringColors = hasNew
    ? ['#8B5CF6', '#3B82F6', '#06B6D4'] // Purple to blue gradient for new
    : [colors.border, colors.border]; // Gray for viewed

  const avatarSize = size - 8; // Account for ring padding

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <LinearGradient
          colors={ringColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ringGradient}
        >
          <View style={styles.ringInner}>
            {isOwn ? (
              <View style={styles.ownAvatarContainer}>
                <Avatar avatarKey={avatarKey} size={size - 14} />
                <View style={styles.plusIconContainer}>
                  <Text style={styles.plusIcon}>+</Text>
                </View>
              </View>
            ) : (
              <Avatar avatarKey={avatarKey} size={size - 14} />
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {handle && (
        <Text style={styles.handle} numberOfLines={1}>
          {isOwn ? 'Your Scoop' : handle}
        </Text>
      )}
    </View>
  );
});

const createStyles = (colors: any, size: number) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      marginRight: 12,
      width: size + 8,
    },
    ringGradient: {
      width: size,
      height: size,
      borderRadius: size / 2,
      padding: 3,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ringInner: {
      width: size - 6,
      height: size - 6,
      borderRadius: (size - 6) / 2,
      backgroundColor: colors.background,
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ownAvatarContainer: {
      position: 'relative',
      width: size - 14,
      height: size - 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    plusIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    plusIcon: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
      marginTop: -1,
    },
    handle: {
      fontSize: 11,
      color: colors.text,
      marginTop: 4,
      textAlign: 'center',
      maxWidth: size + 8,
    },
  });
