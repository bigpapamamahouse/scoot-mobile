import './awsConfig';  // must come BEFORE any Auth calls
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './navigation';
import { NotificationsProvider } from './lib/notifications';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent />
      <NotificationsProvider>
        <RootNavigator />
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
