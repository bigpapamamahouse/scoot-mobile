import './awsConfig';  // must come BEFORE any Auth calls
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation';
import { NotificationsProvider } from './lib/notifications';
import { ThemeProvider } from './theme';
import { CurrentUserProvider } from './contexts/CurrentUserContext';
import { UploadProvider } from './contexts/UploadContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrentUserProvider>
          <NotificationsProvider>
            <UploadProvider>
              <RootNavigator />
            </UploadProvider>
          </NotificationsProvider>
        </CurrentUserProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
