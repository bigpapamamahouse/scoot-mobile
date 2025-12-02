import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { User } from '../types';
import { Avatar } from './Avatar';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';

interface MentionAutocompleteProps {
  users: User[];
  loading: boolean;
  onSelectUser: (user: User) => void;
  maxHeight?: number;
}

export function MentionAutocomplete({
  users,
  loading,
  onSelectUser,
  maxHeight = 200,
}: MentionAutocompleteProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={[styles.container, { maxHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { maxHeight }]}>
      <FlatList
        data={users}
        keyExtractor={(item, index) => item.id || item.handle || `user-${index}`}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => onSelectUser(item)}
          >
            <Avatar avatarKey={item.avatarKey} size={32} />
            <View style={styles.userInfo}>
              <Text style={styles.fullName} numberOfLines={1}>
                {item.fullName || item.handle}
              </Text>
              {item.handle && (
                <Text style={styles.handle} numberOfLines={1}>
                  @{item.handle}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.elevated,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.md,
      overflow: 'hidden',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
      gap: spacing[2],
    },
    loadingText: {
      color: colors.text.secondary,
      fontSize: typography.fontSize.sm,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[3],
      gap: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    userInfo: {
      flex: 1,
    },
    fullName: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
    },
    handle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
  });
