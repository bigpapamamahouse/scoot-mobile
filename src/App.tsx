import './awsConfig';  // must come BEFORE any Auth calls
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation';
import { NotificationsProvider } from './lib/notifications';
import { ThemeProvider } from './theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NotificationsProvider>
          <RootNavigator />
        </NotificationsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
