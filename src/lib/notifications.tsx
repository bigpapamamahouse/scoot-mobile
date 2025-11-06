import React from 'react';
import { AppState, Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { NotificationsAPI, PostsAPI } from '../api';
import { Notification } from '../types';
import {
  readPushToken,
  writePushToken,
  readSeenNotificationIds,
  writeSeenNotificationIds,
} from './storage';
import { navigationRef } from '../navigation/navigationRef';

type NotificationsContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllRead: () => void;
  recordSeen: (items: Notification[]) => Promise<void>;
};

const NotificationsContext = React.createContext<NotificationsContextValue>({
  unreadCount: 0,
  refresh: async () => {},
  markAllRead: () => {},
  recordSeen: async () => {},
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const MAX_TRACKED_IDS = 200;

function titleForNotification(notification: Notification) {
  const type = (notification.type || '').toLowerCase();
  if (type.includes('comment')) {
    return 'New comment';
  }
  if (type.includes('reaction') || type.includes('like')) {
    return 'New reaction';
  }
  if (type.includes('mention')) {
    return 'New mention';
  }
  if (type.includes('follow')) {
    return 'Follow request';
  }
  return 'Notification';
}

function bodyForNotification(notification: Notification) {
  if (notification.message) {
    return notification.message;
  }
  const sender = notification.fromHandle || notification.fromUserId?.slice(0, 8) || 'Someone';
  const type = (notification.type || '').toLowerCase();
  if (type.includes('comment')) {
    return `@${sender} commented on your post.`;
  }
  if (type.includes('reaction') || type.includes('like')) {
    return `@${sender} reacted to your post.`;
  }
  if (type.includes('mention')) {
    return `@${sender} mentioned you.`;
  }
  if (type.includes('follow')) {
    return `@${sender} wants to follow you.`;
  }
  return `New activity from @${sender}.`;
}

async function requestPushPermissions() {
  if (!Device.isDevice) {
    return { granted: false, token: null };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const requestResult = await Notifications.requestPermissionsAsync();
    finalStatus = requestResult.status;
  }

  if (finalStatus !== 'granted') {
    return { granted: false, token: null };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  const response = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  return { granted: true, token: response.data ?? null };
}

async function ensurePushTokenRegistered(): Promise<{ granted: boolean }> {
  try {
    const { granted, token } = await requestPushPermissions();
    if (!granted) {
      return { granted: false };
    }

    if (token) {
      const stored = await readPushToken();
      if (stored !== token) {
        try {
          await NotificationsAPI.registerPushToken(token, Platform.OS);
          await writePushToken(token);
        } catch (err) {
          console.warn('Failed to register push token', err);
        }
      }
    }

    return { granted: true };
  } catch (error) {
    console.warn('Push registration error', error);
  }
  return { granted: false };
}

function isFollowRequest(type?: string | null) {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('follow') && normalized.includes('request');
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const permissionGrantedRef = React.useRef(false);
  const initialSyncCompleteRef = React.useRef(false);

  React.useEffect(() => {
    readSeenNotificationIds().then((ids) => {
      seenIdsRef.current = new Set(ids);
    });
  }, []);

  const recordSeen = React.useCallback(async (items: Notification[]) => {
    const next = new Set(seenIdsRef.current);
    let changed = false;
    for (const item of items) {
      if (item.id && !next.has(item.id)) {
        next.add(item.id);
        changed = true;
      }
    }
    if (changed) {
      const ordered = Array.from(next);
      if (ordered.length > MAX_TRACKED_IDS) {
        const trimmed = ordered.slice(ordered.length - MAX_TRACKED_IDS);
        seenIdsRef.current = new Set(trimmed);
        await writeSeenNotificationIds(trimmed);
      } else {
        seenIdsRef.current = next;
        await writeSeenNotificationIds(ordered);
      }
    }
  }, []);

  const maybeTriggerLocalPushes = React.useCallback(
    async (newItems: Notification[]) => {
      if (!permissionGrantedRef.current || newItems.length === 0) {
        return;
      }
      await Promise.all(
        newItems.map((notification) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: titleForNotification(notification),
              body: bodyForNotification(notification),
              data: {
                notificationId: notification.id,
                postId: notification.postId || notification.relatedPostId,
                userId: notification.relatedUserId || notification.fromUserId,
              },
            },
            trigger: null,
          }),
        ),
      ).catch((err) => console.warn('Failed to schedule local notification', err));
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    try {
      const response = await NotificationsAPI.listNotifications(false);
      const items: Notification[] = response.items || [];
      const unread = items.filter((item) => !item.read).length;
      const unseen = items.filter((item) => item.id && !seenIdsRef.current.has(item.id));
      await recordSeen(items);
      if (initialSyncCompleteRef.current) {
        await maybeTriggerLocalPushes(unseen);
      }
      initialSyncCompleteRef.current = true;
      setUnreadCount(unread);
    } catch (error) {
      console.warn('Failed to refresh notifications', error);
    }
  }, [maybeTriggerLocalPushes, recordSeen]);

  const markAllRead = React.useCallback(() => {
    setUnreadCount(0);
  }, []);

  React.useEffect(() => {
    ensurePushTokenRegistered().then(({ granted }) => {
      permissionGrantedRef.current = granted;
    });
  }, []);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 15_000);
    const subscription = Notifications.addNotificationReceivedListener(() => {
      refresh();
    });

    // Handle notification taps for deep linking to posts
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        const postId = data?.postId;

        // If notification has a postId, navigate to that post
        if (postId && navigationRef.isReady()) {
          try {
            const postResponse = await PostsAPI.getPost(postId as string);
            const post = postResponse?.post || postResponse?.item || postResponse?.data || postResponse;

            if (post) {
              // Navigate to the post screen
              navigationRef.navigate('Post' as never, { post } as never);
            } else {
              // Fallback to notifications screen if post not found
              navigationRef.navigate('Notifications' as never);
            }
          } catch (error) {
            console.warn('Failed to load post from notification', error);
            // Fallback to notifications screen on error
            navigationRef.navigate('Notifications' as never);
          }
        } else if (navigationRef.isReady()) {
          // No postId, navigate to notifications screen
          navigationRef.navigate('Notifications' as never);
        }
      }
    );

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        ensurePushTokenRegistered().then(({ granted }) => {
          permissionGrantedRef.current = granted;
        });
        refresh();
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refresh]);

  const contextValue = React.useMemo<NotificationsContextValue>(
    () => ({
      unreadCount,
      refresh,
      markAllRead,
      recordSeen,
    }),
    [markAllRead, recordSeen, refresh, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return React.useContext(NotificationsContext);
}

export function isFollowRequestNotification(notification: Notification) {
  return isFollowRequest(notification.type);
}

