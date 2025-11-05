import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UsersAPI } from '../api';

interface CurrentUser {
  id: string;
  handle?: string;
  email?: string;
  avatarKey?: string | null;
  fullName?: string;
}

interface CurrentUserContextType {
  currentUser: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setCurrentUser: (user: CurrentUser | null) => void;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

/**
 * Global context provider for the current authenticated user.
 * Fetches user data once and shares it across the entire app.
 * This prevents duplicate API calls from multiple components.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const user = await UsersAPI.me();

      // Normalize the user object - handle both id and userId fields
      const userId = (user as any)?.id || (user as any)?.userId;
      if (userId) {
        setCurrentUser({
          id: userId,
          handle: (user as any)?.handle,
          email: (user as any)?.email,
          avatarKey: (user as any)?.avatarKey,
          fullName: (user as any)?.fullName,
        });
      }
    } catch (error) {
      // Silently fail - this is used by many components
      // Logging would create excessive console noise for temporary API issues
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    setLoading(true);
    await fetchUser();
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <CurrentUserContext.Provider value={{ currentUser, loading, refreshUser, setCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/**
 * Hook to access the current authenticated user from global context.
 * This replaces individual API calls in each component.
 */
export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }
  return context;
}

/**
 * Helper function to check if a post or comment belongs to the current user
 */
export function isOwner(
  item: { userId: string; handle?: string },
  currentUser: CurrentUser | null
): boolean {
  if (!currentUser) return false;

  // Check by userId
  if (item.userId === currentUser.id) {
    return true;
  }

  // Check by handle
  if (item.handle && currentUser.handle && item.handle === currentUser.handle) {
    return true;
  }

  return false;
}
