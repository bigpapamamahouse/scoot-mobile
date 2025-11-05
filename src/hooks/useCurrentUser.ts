import { useState, useEffect } from 'react';
import { UsersAPI } from '../api';

interface CurrentUser {
  id: string;
  handle?: string;
  email?: string;
  avatarKey?: string | null;
  fullName?: string;
}

/**
 * Hook to get the current authenticated user.
 * Fetches user data once and caches it for the component lifetime.
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const user = await UsersAPI.me();
        if (cancelled) return;

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
        if (cancelled) return;
        // Silently fail - this hook is used by many components
        // Logging would create excessive console noise for temporary API issues
        setCurrentUser(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { currentUser, loading };
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
