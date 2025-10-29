declare module 'expo-device' {
  export const isDevice: boolean;
}

declare module 'expo-notifications' {
  export type NotificationContentInput = {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };

  export type NotificationRequestInput = {
    content: NotificationContentInput;
    trigger: null | number | Date | { seconds?: number } | undefined;
  };

  export type PermissionStatus = 'undetermined' | 'denied' | 'granted';

  export type NotificationPermissionsStatus = {
    status: PermissionStatus;
  };

  export type Subscription = { remove: () => void };

  export type Notification = {
    request: {
      identifier: string;
    };
  };

  export type NotificationHandler = {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  };

  export const AndroidImportance: {
    readonly DEFAULT: number;
    readonly HIGH: number;
    readonly LOW: number;
    readonly MAX: number;
    readonly MIN: number;
    readonly NONE: number;
    readonly UNSPECIFIED: number;
  };

  export function setNotificationHandler(handler: NotificationHandler): void;
  export function getPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function requestPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function getExpoPushTokenAsync(config?: { projectId?: string }): Promise<{ data: string }>;
  export function setNotificationChannelAsync(
    channelId: string,
    channel: { name: string; importance: number },
  ): Promise<void>;
  export function scheduleNotificationAsync(request: NotificationRequestInput): Promise<string>;
  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void,
  ): Subscription;
}
