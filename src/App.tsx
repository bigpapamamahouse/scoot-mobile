import './awsConfig';  // must come BEFORE any Auth calls
import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation';
import { NotificationsProvider } from './lib/notifications';
import { ThemeProvider } from './theme';
import { CurrentUserProvider, useCurrentUser } from './contexts/CurrentUserContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UploadProvider } from './contexts/UploadContext';
import AnimatedSplash from './components/AnimatedSplash';

function AppContent({ onReady }: { onReady: () => void }) {
  const { loading: userLoading } = useCurrentUser();
  const { isChecking: authChecking } = useAuth();

  useEffect(() => {
    // Only signal ready when both user data and auth check are complete
    if (!userLoading && !authChecking) {
      onReady();
    }
  }, [userLoading, authChecking, onReady]);

  return (
    <NotificationsProvider>
      <UploadProvider>
        <RootNavigator />
      </UploadProvider>
    </NotificationsProvider>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AnimatedSplash isReady={isReady}>
          <CurrentUserProvider>
            <AuthProvider>
              <AppContent onReady={() => setIsReady(true)} />
            </AuthProvider>
          </CurrentUserProvider>
        </AnimatedSplash>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
