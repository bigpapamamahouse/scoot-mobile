
import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationsAPI } from '../api';
import { Notification } from '../types';
import { isFollowRequestNotification, useNotifications } from '../lib/notifications';
import { useTheme, spacing, borderRadius, shadows } from '../theme';

type NotificationListItem = Notification & { handledAction?: 'accept' | 'decline' };

export default function NotificationsScreen(){
  const { colors } = useTheme();
  const { markAllRead, recordSeen, refresh } = useNotifications();
  const [items, setItems] = React.useState<NotificationListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const load = React.useCallback(async (opts?: { refreshing?: boolean }) => {
    if (opts?.refreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await NotificationsAPI.listNotifications(true);
      const nextItems = ((response.items || []) as Notification[]).map(
        (item) => ({ ...item } as NotificationListItem),
      );
      setItems(nextItems);
      await recordSeen(nextItems);
      markAllRead();
    } catch (error: any) {
      console.warn('Failed to load notifications', error);
      Alert.alert('Notifications', error?.message || 'Unable to load notifications right now.');
    } finally {
      if (opts?.refreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [markAllRead, recordSeen]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = React.useCallback(() => {
    load({ refreshing: true }).then(() => {
      refresh();
    });
  }, [load, refresh]);

  const handleFollowAction = React.useCallback(
    async (notification: NotificationListItem, action: 'accept' | 'decline') => {
      const userId = notification.relatedUserId || notification.fromUserId;
      if (!userId) {
        return;
      }
      const actionKey = `${notification.id}:${action}`;
      setActionLoading(actionKey);
      try {
        if (action === 'accept') {
          await NotificationsAPI.acceptFollow(userId);
        } else {
          await NotificationsAPI.declineFollow(userId);
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, handledAction: action }
              : item,
          ),
        );
        refresh();
      } catch (error: any) {
        console.warn('Unable to update follow request', error);
        Alert.alert(
          'Follow request',
          error?.message || 'Unable to update the follow request. Please try again.',
        );
      } finally {
        setActionLoading((current) => (current === actionKey ? null : current));
      }
    },
    [refresh],
  );

  const renderEmpty = React.useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No notifications yet.</Text>
      </View>
    );
  }, [loading]);

  const renderItem = React.useCallback(
    ({ item }: { item: NotificationListItem }) => {
      const followRequest = isFollowRequestNotification(item);
      const handledAction = item.handledAction;
      const acceptKey = `${item.id}:accept`;
      const declineKey = `${item.id}:decline`;
      const acceptBusy = actionLoading === acceptKey;
      const declineBusy = actionLoading === declineKey;
      const timestamp = item.createdAt ? new Date(item.createdAt) : null;
      const sender = item.fromHandle || item.fromUserId?.slice(0, 8) || 'unknown';

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sender}>@{sender}</Text>
            {followRequest && !handledAction && (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>Request</Text>
              </View>
            )}
          </View>
          <Text style={styles.message}>{item.message || 'Notification'}</Text>
          {followRequest && handledAction && (
            <Text
              style={[
                styles.followStatus,
                handledAction === 'decline' && styles.followStatusDeclined,
              ]}
            >
              {handledAction === 'accept'
                ? 'You accepted this follow request.'
                : 'You declined this follow request.'}
            </Text>
          )}
          {followRequest && !handledAction && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleFollowAction(item, 'accept')}
                disabled={acceptBusy || declineBusy}
              >
                {acceptBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionLabel}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleFollowAction(item, 'decline')}
                disabled={acceptBusy || declineBusy}
              >
                {declineBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionLabel}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {timestamp && (
            <Text style={styles.timestamp}>{timestamp.toLocaleString()}</Text>
          )}
        </View>
      );
    },
    [actionLoading, handleFollowAction],
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  listContent: {
    padding: spacing[3],
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  sender: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.text.primary,
  },
  message: {
    fontSize: 14,
    color: colors.text.primary,
  },
  timestamp: {
    marginTop: spacing[3],
    fontSize: 12,
    color: colors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing[3],
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    marginRight: spacing[3],
  },
  acceptButton: {
    backgroundColor: colors.success.main,
  },
  declineButton: {
    backgroundColor: colors.error.main,
  },
  actionLabel: {
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[10],
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  requestBadge: {
    backgroundColor: colors.warning.main,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  requestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning.dark,
  },
  followStatus: {
    marginTop: spacing[3],
    color: colors.success.dark,
    fontWeight: '600',
  },
  followStatusDeclined: {
    color: colors.error.dark,
  },
  separator: {
    height: spacing[3],
  },
});
