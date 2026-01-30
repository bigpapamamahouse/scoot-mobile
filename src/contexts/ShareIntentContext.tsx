import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import { navigationRef } from '../navigation/navigationRef';

interface ShareIntentContextType {
  sharedText: string | null;
  clearSharedText: () => void;
}

const ShareIntentContext = createContext<ShareIntentContextType>({
  sharedText: null,
  clearSharedText: () => {},
});

export function ShareIntentProvider({ children }: { children: React.ReactNode }) {
  const [sharedText, setSharedText] = useState<string | null>(null);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  const clearSharedText = useCallback(() => {
    setSharedText(null);
    resetShareIntent();
  }, [resetShareIntent]);

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      // Handle the shared content
      let text = '';

      if (shareIntent.text) {
        text = shareIntent.text;
      } else if (shareIntent.webUrl) {
        text = shareIntent.webUrl;
      }

      if (text) {
        console.log('[ShareIntent] Received shared content:', text);
        setSharedText(text);

        // Navigate to compose screen if navigation is ready
        // Small delay to ensure navigation is mounted
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('ComposePost' as never, { initialText: text } as never);
          }
        }, 100);
      }
    }
  }, [hasShareIntent, shareIntent]);

  return (
    <ShareIntentContext.Provider value={{ sharedText, clearSharedText }}>
      {children}
    </ShareIntentContext.Provider>
  );
}

export function useSharedContent() {
  return useContext(ShareIntentContext);
}
