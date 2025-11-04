import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactionWithUsers } from '../types';
import { Avatar } from './Avatar';
import { resolveHandle } from '../lib/resolveHandle';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';

interface ReactionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  reactions: ReactionWithUsers[];
  loading?: boolean;
  onUserPress?: (userId: string, userHandle?: string) => void;
}

export function ReactionDetailsModal({
  visible,
  onClose,
  reactions,
  loading = false,
  onUserPress,
}: ReactionDetailsModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Debug logging
  React.useEffect(() => {
    if (visible) {
      console.log('[ReactionDetailsModal] Modal opened, onUserPress available:', !!onUserPress);
      console.log('[ReactionDetailsModal] Reactions count:', reactions.length);
      reactions.forEach((r, i) => {
        console.log(`[ReactionDetailsModal] Reaction ${i}: ${r.emoji}, users:`, r.users?.length || 0);
        r.users?.forEach((u, j) => {
          console.log(`  User ${j}: id=${u.id}, handle=${u.handle}`);
        });
      });
    }
  }, [visible, onUserPress, reactions]);

  const renderReactionSection = ({ item: reaction }: { item: ReactionWithUsers }) => {
    if (!reaction.users || reaction.users.length === 0) {
      return null;
    }

    return (
      <View style={styles.reactionSection} pointerEvents="box-none">
        <View style={styles.reactionHeader}>
          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
          <Text style={styles.reactionCount}>{reaction.count}</Text>
        </View>
        <View style={styles.usersList} pointerEvents="box-none">
          {reaction.users.map((user, index) => {
            const handle = resolveHandle(user);
            const userId = user.id || `user-${index}`;
            const displayHandle = handle ? `@${handle}` : `@${userId.slice(0, 8)}`;

            const handlePress = () => {
              console.log('[ReactionDetailsModal] User pressed:', {
                userId: user.id,
                handle,
                hasOnUserPress: !!onUserPress,
                canNavigate: !!(onUserPress && (user.id || handle))
              });
              if (onUserPress && (user.id || handle)) {
                console.log('[ReactionDetailsModal] Navigating to profile...');
                onClose(); // Close modal before navigating
                onUserPress(user.id || '', handle);
              } else {
                console.log('[ReactionDetailsModal] Cannot navigate - missing callback, userId, and handle');
              }
            };

            const canPress = onUserPress && (user.id || handle);

            return (
              <Pressable
                key={`${reaction.emoji}-${userId}-${index}`}
                style={({ pressed }) => [
                  styles.userRow,
                  canPress && styles.userRowClickable,
                  pressed && canPress && styles.userRowPressed
                ]}
                onPress={handlePress}
                disabled={!canPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Avatar avatarKey={user.avatarKey} size={32} />
                <Text style={[styles.userHandle, canPress && styles.userHandleClickable]}>
                  {displayHandle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const reactionsWithUsers = reactions.filter(r => r.users && r.users.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Reactions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
          ) : reactionsWithUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reactions yet</Text>
            </View>
          ) : (
            <FlatList
              data={reactionsWithUsers}
              renderItem={renderReactionSection}
              keyExtractor={(item, index) => `${item.emoji}-${index}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay.dark,
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background.elevated,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '80%',
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    title: {
      ...typography.styles.h3,
      color: colors.text.primary,
    },
    closeButton: {
      padding: spacing[1],
    },
    listContent: {
      padding: spacing[4],
      gap: spacing[4],
    },
    reactionSection: {
      gap: spacing[3],
    },
    reactionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    reactionEmoji: {
      fontSize: typography.fontSize.xl,
    },
    reactionCount: {
      ...typography.styles.label,
      color: colors.text.secondary,
    },
    usersList: {
      gap: spacing[2],
      marginLeft: spacing[2],
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.md,
    },
    userRowClickable: {
      backgroundColor: colors.background.primary,
    },
    userRowPressed: {
      backgroundColor: colors.neutral[100],
      opacity: 0.8,
    },
    userHandle: {
      ...typography.styles.body,
      color: colors.text.primary,
    },
    userHandleClickable: {
      color: colors.primary[500],
    },
    loadingContainer: {
      padding: spacing[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      padding: spacing[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...typography.styles.body,
      color: colors.text.secondary,
    },
  });
