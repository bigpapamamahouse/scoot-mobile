import './awsConfig';  // must come BEFORE any Auth calls
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import RootNavigator from './navigation';
import { NotificationsProvider } from './lib/notifications';

export default function App() {
  React.useEffect(() => {
    Ionicons.loadFont().catch((err) => {
      console.warn('Failed to load Ionicons font', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent />
      <NotificationsProvider>
        <RootNavigator />
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
