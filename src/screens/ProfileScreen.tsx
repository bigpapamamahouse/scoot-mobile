import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UsersAPI, PostsAPI } from '../api';
import { User, Post } from '../types';
import PostCard from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';
import { cache, CacheKeys, CacheTTL } from '../lib/cache';
import { useCurrentUser } from '../hooks/useCurrentUser';

const POSTS_PER_PAGE = 20;

type ProfileIdentity = {
  id?: string | null;
  handle?: string | null;
  avatarKey?: string | null;
  email?: string | null;
  fullName?: string | null;
  createdAt?: string | null;
};

export default function ProfileScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { currentUser } = useCurrentUser(); // Use global context instead of fetching
  const [user, setUser] = React.useState<ProfileIdentity | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [followerCount, setFollowerCount] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState(0);
  const [followStatus, setFollowStatus] = React.useState<'none' | 'pending' | 'following'>('none');
  const [followLoading, setFollowLoading] = React.useState(false);

  // Extract route params to stable values to prevent unnecessary re-renders
  const routeUserHandle = route?.params?.userHandle || route?.params?.handle || route?.params?.username;
  const routeUserId = route?.params?.userId || route?.params?.id || route?.params?.profileId;

  const resolvePosts = React.useCallback((payload: unknown): Post[] => {
    if (!payload) return [];

    const tryArray = (value: unknown): Post[] | null => {
      if (Array.isArray(value)) return value as Post[];
      return null;
    };

    const direct = tryArray(payload);
    if (direct) return direct;

    if (typeof payload === 'object' && payload !== null) {
      const candidates: unknown[] = [];
      const maybeRecord = payload as Record<string, unknown>;
      candidates.push(maybeRecord.items);
      candidates.push(maybeRecord.posts);
      candidates.push(maybeRecord.data);
      candidates.push(maybeRecord.results);

      if (maybeRecord.data && typeof maybeRecord.data === 'object') {
        const dataRecord = maybeRecord.data as Record<string, unknown>;
        candidates.push(dataRecord.items);
      }

      if (maybeRecord.posts && typeof maybeRecord.posts === 'object') {
        const postsRecord = maybeRecord.posts as Record<string, unknown>;
        candidates.push(postsRecord.items);
      }

      for (const candidate of candidates) {
        const arr = tryArray(candidate);
        if (arr) return arr;
      }
    }

    return [];
  }, []);

  const normalizeIdCandidate = React.useCallback((value: unknown): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return null;
  }, []);

  const normalizeHandleCandidate = React.useCallback((value: unknown): string | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed.replace(/^@/, '').toLowerCase();
      }
    }
    return null;
  }, []);

  const filterPostsForUser = React.useCallback(
    (items: Post[], identity: { id?: string | null; handle?: string | null }) => {
      const normalizedId = typeof identity.id === 'string' ? identity.id.trim() : null;
      const normalizedHandle =
        typeof identity.handle === 'string'
          ? identity.handle.replace(/^@/, '').trim().toLowerCase()
          : null;

      if (!normalizedId && !normalizedHandle) {
        return items;
      }

      return items.filter((raw) => {
        const candidate: any = raw;

        const idCandidates = [
          candidate?.userId,
          candidate?.user?.id,
          candidate?.authorId,
          candidate?.author?.id,
          candidate?.ownerId,
          candidate?.profileId,
          candidate?.createdById,
        ]
          .map(normalizeIdCandidate)
          .filter(Boolean);

        if (normalizedId && idCandidates.includes(normalizedId)) {
          return true;
        }

        const handleCandidates = [
          candidate?.handle,
          candidate?.user?.handle,
          candidate?.user?.username,
          candidate?.author?.handle,
          candidate?.authorHandle,
          candidate?.username,
          candidate?.profile?.handle,
        ]
          .map(normalizeHandleCandidate)
          .filter(Boolean);

        if (normalizedHandle && handleCandidates.includes(normalizedHandle)) {
          return true;
        }

        return false;
      });
    },
    [normalizeHandleCandidate, normalizeIdCandidate]
  );

  const deriveIdentityFromPosts = React.useCallback(
    (items: Post[]): ProfileIdentity | null => {
      for (const raw of items) {
        if (!raw) continue;
        const candidate: any = raw;

        const derivedId =
          normalizeIdCandidate(candidate?.userId) ||
          normalizeIdCandidate(candidate?.authorId) ||
          normalizeIdCandidate(candidate?.ownerId) ||
          normalizeIdCandidate(candidate?.profileId) ||
          normalizeIdCandidate(candidate?.createdById) ||
          normalizeIdCandidate(candidate?.user?.id) ||
          normalizeIdCandidate(candidate?.author?.id) ||
          normalizeIdCandidate(candidate?.profile?.id);

        const derivedHandle =
          normalizeHandleCandidate(candidate?.handle) ||
          normalizeHandleCandidate(candidate?.user?.handle) ||
          normalizeHandleCandidate(candidate?.user?.username) ||
          normalizeHandleCandidate(candidate?.author?.handle) ||
          normalizeHandleCandidate(candidate?.authorHandle) ||
          normalizeHandleCandidate(candidate?.username) ||
          normalizeHandleCandidate(candidate?.profile?.handle);

        const avatarKey =
          candidate?.avatarKey ||
          candidate?.user?.avatarKey ||
          candidate?.author?.avatarKey ||
          candidate?.profile?.avatarKey;

        const fullName =
          candidate?.user?.fullName ||
          candidate?.author?.fullName ||
          candidate?.profile?.fullName;

        const email =
          candidate?.user?.email ||
          candidate?.author?.email ||
          candidate?.profile?.email;

        if (derivedId || derivedHandle || avatarKey || fullName || email) {
          const identity: ProfileIdentity = {};
          if (derivedId) {
            identity.id = derivedId;
          }
          if (derivedHandle) {
            identity.handle = derivedHandle;
          }
          if (avatarKey !== undefined) {
            identity.avatarKey = avatarKey ?? null;
          }
          if (fullName !== undefined) {
            identity.fullName = fullName ?? null;
          }
          if (email !== undefined) {
            identity.email = email ?? null;
          }
          return identity;
        }
      }
      return null;
    },
    [normalizeHandleCandidate, normalizeIdCandidate]
  );

  const load = React.useCallback(
    async (options?: { skipSpinner?: boolean; pageNum?: number; append?: boolean }) => {
      if (!options?.skipSpinner) {
        setLoading(true);
      }

      const pageNum = options?.pageNum ?? 0;
      const append = options?.append ?? false;

      const normalizeHandle = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const trimmed = value.replace(/^@/, '').trim();
        return trimmed || null;
      };

      const normalizeId = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed || null;
      };

      const requestedHandle = normalizeHandle(routeUserHandle);
      const requestedUserId = normalizeId(routeUserId);

      // OPTIMIZATION: Check cache FIRST for instant display (before any API calls)
      let hasValidCache = false;
      let shouldSkipAPICall = false;
      if (!append && pageNum === 0) {
        const cacheIdentifier = requestedUserId || requestedHandle || 'unknown';
        const cachedPosts = cache.get<Post[]>(CacheKeys.userPosts(cacheIdentifier, 0));
        const cachedUser = cache.get<ProfileIdentity>(CacheKeys.userProfile(cacheIdentifier));

        if (cachedPosts && cachedPosts.length > 0) {
          console.log('[ProfileScreen] Loading from cache:', cachedPosts.length, 'posts');
          setPosts(cachedPosts);
          hasValidCache = true;
        }

        if (cachedUser) {
          console.log('[ProfileScreen] Loading user from cache:', cachedUser.handle || cachedUser.id);
          setUser(cachedUser);
          hasValidCache = true;
        }

        // If we have BOTH cached posts and user, we can skip the posts API call
        // But we'll still load follower/following counts since they aren't cached
        if (cachedPosts && cachedPosts.length > 0 && cachedUser) {
          shouldSkipAPICall = true;
          console.log('[ProfileScreen] Using cached posts, will only fetch counts');
        }

        // If we have valid cache, hide loading spinner immediately
        if (hasValidCache && !options?.skipSpinner) {
          setLoading(false);
        }
      }

      let targetIdentity: ProfileIdentity | null = null;

      try {
        // Use currentUser from global context (already loaded) - no need for API call

        let targetHandle = requestedHandle;
        let targetUserId = requestedUserId;

        const viewerHandle =
          currentUser?.handle?.replace(/^@/, '').trim().toLowerCase() || null;
        const viewerId = (() => {
          const rawId = currentUser?.id ?? (currentUser as any)?.userId;
          if (typeof rawId === 'string') {
            const trimmed = rawId.trim();
            if (trimmed.length > 0) {
              return trimmed;
            }
          }
          return null;
        })();

        const isSelfRequest = (() => {
          // Only treat as self-request if BOTH:
          // 1. No route params were provided at all (not even empty/null values)
          // 2. No target was resolved
          const hasRouteParams = routeUserHandle !== undefined || routeUserId !== undefined;
          if (!targetHandle && !targetUserId) {
            // If route params were explicitly provided but resolved to nothing,
            // this is NOT a self-request (it's an invalid/missing user)
            // Only treat as self-request if no params were provided at all
            return !hasRouteParams;
          }
          if (targetHandle && viewerHandle) {
            if (targetHandle.toLowerCase() === viewerHandle) {
              return true;
            }
          }
          if (targetUserId && viewerId) {
            if (targetUserId === viewerId) {
              return true;
            }
          }
          return false;
        })();

        if (isSelfRequest) {
          if (!targetHandle && viewerHandle) {
            targetHandle = viewerHandle;
          }
          if (!targetUserId && viewerId) {
            targetUserId = viewerId;
          }
        }

        if (isSelfRequest && currentUser) {
          targetIdentity = {
            id: currentUser.id ?? null,
            handle: currentUser.handle ?? null,
            avatarKey: currentUser.avatarKey ?? null,
            email: currentUser.email ?? null,
            fullName: currentUser.fullName ?? null,
            createdAt: currentUser.createdAt ?? null,
          };
        }

        if (!targetIdentity && (targetHandle || targetUserId)) {
          try {
            const fetched = await UsersAPI.getUserByIdentity({
              handle: targetHandle,
              userId: targetUserId,
            });
            if (fetched) {
              targetIdentity = {
                id: fetched.id ?? null,
                handle: fetched.handle ?? null,
                avatarKey: fetched.avatarKey ?? null,
                email: fetched.email ?? null,
                fullName: fetched.fullName ?? null,
                createdAt: fetched.createdAt ?? null,
              };
              if (fetched.handle) {
                targetHandle = fetched.handle.replace(/^@/, '').trim() || targetHandle;
              }
              if (fetched.id) {
                targetUserId = fetched.id;
              } else {
                console.warn('[Profile] Fetched user has no ID!');
              }
            }
            // Silently handle case where user doesn't exist (getUserByIdentity logs this)
          } catch (err: any) {
            // Only log non-404 errors - 404s are already handled by getUserByIdentity
            const message = String(err?.message || '');
            if (!message.includes('404') && !message.includes('Not Found')) {
              console.warn(
                'Failed to load requested profile:',
                err?.message || String(err)
              );
            }
          }
        }

        if (!targetIdentity && (targetHandle || targetUserId)) {
          targetIdentity = {
            id: targetUserId ?? null,
            handle: targetHandle ?? null,
          };
        }

        if (targetIdentity?.handle) {
          targetHandle = targetIdentity.handle.replace(/^@/, '').trim() || targetHandle;
        }
        if (targetIdentity?.id) {
          targetUserId = targetIdentity.id.trim();
        }

        // Generate cache key based on user identifier
        const cacheIdentifier = targetUserId || targetHandle || 'unknown';

        let resolvedIdentity = targetIdentity;

        // Skip posts API call if we already have cached data
        if (!shouldSkipAPICall) {
          const offset = pageNum * POSTS_PER_PAGE;
          const postsData = await PostsAPI.getUserPosts({
            handle: targetHandle,
            userId: targetUserId,
            limit: POSTS_PER_PAGE,
            offset,
          });
          const normalizedPosts = resolvePosts(postsData);
          const filteredPosts = filterPostsForUser(normalizedPosts, {
            id: targetUserId,
            handle: targetHandle,
          });
          // Silently filter posts - no need to log this routine operation
          if (!filteredPosts.length && postsData && !Array.isArray(postsData)) {
            console.warn('Unrecognized user posts response shape', postsData);
          }

          // Update posts state with append support and deduplication
          if (append) {
            setPosts((prev) => {
              // Create a Set of existing post IDs for O(1) lookup
              const existingIds = new Set(prev.map(p => p.id));
              // Filter out any new posts that already exist
              const uniqueNewPosts = filteredPosts.filter((post: Post) => !existingIds.has(post.id));
              return [...prev, ...uniqueNewPosts];
            });
          } else {
            setPosts(filteredPosts);
            // Cache the first page for instant loads
            if (pageNum === 0 && filteredPosts.length > 0) {
              cache.set(CacheKeys.userPosts(cacheIdentifier, 0), filteredPosts, CacheTTL.userPosts);
            }
          }

          // Check if there are more posts to load
          setHasMore(filteredPosts.length >= POSTS_PER_PAGE);

          const derivedIdentity = deriveIdentityFromPosts(filteredPosts);
          if (derivedIdentity) {
            resolvedIdentity = {
              ...(resolvedIdentity ?? {}),
              ...derivedIdentity,
              id: derivedIdentity.id ?? resolvedIdentity?.id ?? null,
              handle: derivedIdentity.handle ?? resolvedIdentity?.handle ?? null,
              avatarKey: derivedIdentity.avatarKey ?? resolvedIdentity?.avatarKey,
              fullName: derivedIdentity.fullName ?? resolvedIdentity?.fullName,
              email: derivedIdentity.email ?? resolvedIdentity?.email ?? null,
            };
          }

          if (!resolvedIdentity && (targetHandle || targetUserId)) {
            resolvedIdentity = {
              id: targetUserId ?? null,
              handle: targetHandle ?? null,
            };
          }

          if (!resolvedIdentity && filteredPosts.length) {
            resolvedIdentity = deriveIdentityFromPosts(filteredPosts);
          }

          const finalUserToSet = resolvedIdentity ?? targetIdentity ?? null;
          setUser(finalUserToSet);

          // Cache user profile (only on first page load)
          if (pageNum === 0 && finalUserToSet) {
            const cacheIdentifier = finalUserToSet.id || finalUserToSet.handle || 'unknown';
            cache.set(CacheKeys.userProfile(cacheIdentifier), finalUserToSet, CacheTTL.userProfile);
          }
        }

        // Load follower/following counts and follow status (only on first page)
        const finalIdentity = resolvedIdentity;
        const userHandle = finalIdentity?.handle?.replace(/^@/, '').trim();
        if (userHandle && pageNum === 0) {
          try {
            // OPTIMIZATION: Parallelize independent API calls for better performance
            const [profileData, followersData, followingData] = await Promise.all([
              UsersAPI.getUser(userHandle),
              UsersAPI.listFollowers(userHandle),
              UsersAPI.listFollowing(userHandle),
            ]);

            // Update user state with complete profile data including fullName
            if (profileData && typeof profileData === 'object') {
              setUser(prev => ({
                ...(prev ?? {}),
                id: (profileData as any).id ?? prev?.id ?? null,
                handle: (profileData as any).handle ?? prev?.handle ?? null,
                avatarKey: (profileData as any).avatarKey ?? prev?.avatarKey ?? null,
                email: (profileData as any).email ?? prev?.email ?? null,
                fullName: (profileData as any).fullName ?? prev?.fullName ?? null,
                createdAt: (profileData as any).createdAt ?? prev?.createdAt ?? null,
              }));
            }

            const followers = Array.isArray(followersData) ? followersData :
              (followersData?.items || followersData?.followers || []);
            setFollowerCount(followers.length);

            const following = Array.isArray(followingData) ? followingData :
              (followingData?.items || followingData?.following || []);
            setFollowingCount(following.length);

            // Check follow status from profile data
            // Use viewerId from earlier in the function (it's in the same scope)
            if (!isSelfRequest) {
              // Use followStatus and isFollowPending from API if available
              if (profileData && typeof profileData === 'object') {
                if ('isFollowPending' in profileData && profileData.isFollowPending === true) {
                  setFollowStatus('pending');
                } else if ('followStatus' in profileData) {
                  const status = profileData.followStatus;
                  if (status === 'pending' || status === 'requested') {
                    setFollowStatus('pending');
                  } else if (status === 'following' || status === 'accepted') {
                    setFollowStatus('following');
                  } else {
                    setFollowStatus('none');
                  }
                } else if ('isFollowing' in profileData && profileData.isFollowing === true) {
                  setFollowStatus('following');
                } else {
                  // Fallback: check if in followers list (requires viewerId)
                  const isUserFollowing = viewerId
                    ? followers.some((f: any) => f.id === viewerId)
                    : false;
                  setFollowStatus(isUserFollowing ? 'following' : 'none');
                }
              } else {
                // Fallback: check if in followers list (requires viewerId)
                const isUserFollowing = viewerId
                  ? followers.some((f: any) => f.id === viewerId)
                  : false;
                setFollowStatus(isUserFollowing ? 'following' : 'none');
              }
            }
          } catch (err) {
            console.warn('Failed to load follower/following counts:', err);
          }
        }
      } catch (e: any) {
        console.warn('Failed to load profile:', e?.message || String(e));
        if (!options?.skipSpinner) {
          setUser(targetIdentity ?? null);
          setPosts([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [deriveIdentityFromPosts, filterPostsForUser, resolvePosts, routeUserHandle, routeUserId, currentUser]
  );

  // Track if initial load has completed to prevent unnecessary reloads
  const initialLoadCompleteRef = React.useRef(false);

  React.useEffect(() => {
    // Only run initial load once on mount
    if (!initialLoadCompleteRef.current) {
      load().finally(() => {
        initialLoadCompleteRef.current = true;
      });
    }
  }, []); // Empty deps - only run on mount

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Skip if this is the initial mount (initial load handles it)
      if (!initialLoadCompleteRef.current) {
        return;
      }

      // Check if cache is stale before reloading
      const cacheIdentifier = routeUserId || routeUserHandle || 'unknown';
      const cachedPosts = cache.get<Post[]>(CacheKeys.userPosts(cacheIdentifier, 0));
      const cachedUser = cache.get<ProfileIdentity>(CacheKeys.userProfile(cacheIdentifier));

      // Only reload if we don't have cached data (cache is stale or missing)
      if (!cachedPosts || !cachedUser) {
        load();
      }
      // If cache exists, user can manually refresh with pull-to-refresh
    });
    return unsubscribe;
  }, [navigation, load, routeUserId, routeUserHandle]);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    await load({ skipSpinner: true, pageNum: nextPage, append: true });
    setPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    load({ skipSpinner: true, pageNum: 0, append: false }).finally(() => setRefreshing(false));
  }, [load]);

  const handlePostUpdated = React.useCallback((updatedPost: Post) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  }, []);

  const handlePostDeleted = React.useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const isViewingSelf = React.useMemo(() => {
    // If either user is not loaded yet, show follow button (return false)
    // This ensures the button appears while loading and for other users
    if (!currentUser || !user) return false;

    const normalizeId = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const normalizeHandle = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.replace(/^@+/, '').trim().toLowerCase();
      return trimmed.length > 0 ? trimmed : null;
    };

    const viewerId = normalizeId((currentUser as any)?.id) || normalizeId((currentUser as any)?.userId);
    const userId = normalizeId((user as any)?.id) || normalizeId((user as any)?.userId);

    if (viewerId && userId && viewerId === userId) {
      return true;
    }

    const viewerHandle = normalizeHandle((currentUser as any)?.handle);
    const userHandle = normalizeHandle((user as any)?.handle);

    if (viewerHandle && userHandle && viewerHandle === userHandle) {
      return true;
    }

    return false;
  }, [user, currentUser]);

  const openSettings = React.useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const headerRight = React.useMemo(() => {
    if (!isViewingSelf) {
      return undefined;
    }
    return () => (
      <Button
        title="Settings"
        onPress={openSettings}
        variant="ghost"
        size="sm"
      />
    );
  }, [isViewingSelf, openSettings]);

  React.useEffect(() => {
    if (!navigation?.setOptions) return;
    const options: Record<string, unknown> = {};
    if (isViewingSelf) {
      options.title = 'Profile';
    } else if (user?.handle) {
      options.title = `@${user.handle}`;
    } else if (user?.fullName) {
      options.title = user.fullName;
    } else if (user?.id) {
      options.title = user.id.slice(0, 8);
    }
    options.headerRight = headerRight;
    navigation.setOptions(options);
  }, [headerRight, isViewingSelf, navigation, user?.fullName, user?.handle, user?.id]);

  const displayHandle = React.useMemo(() => {
    if (user?.handle) {
      const normalizedHandle = user.handle.replace(/^@+/, '');
      return `@${normalizedHandle || user.handle}`;
    }
    if (user?.id) return `@${user.id.slice(0, 8)}`;
    return '@Unknown';
  }, [user]);

  const postsSectionTitle = React.useMemo(() => {
    if (isViewingSelf) return 'Your Posts';
    const baseHandle = user?.handle?.replace(/^@+/, '');
    const base = baseHandle || user?.fullName || user?.id?.slice(0, 8) || 'User';
    if (!base) return 'Posts';
    const needsApostrophe = /s$/i.test(base);
    return `${base}${needsApostrophe ? "'" : "'s"} Posts`;
  }, [isViewingSelf, user?.fullName, user?.handle, user?.id]);

  const handleFollowPress = React.useCallback(async () => {
    const userHandle = user?.handle?.replace(/^@/, '');
    if (!userHandle || followLoading) {
      return;
    }

    // If already following, show confirmation dialog
    if (followStatus === 'following') {
      Alert.alert(
        'Unfollow',
        `Are you sure you want to unfollow @${userHandle}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Unfollow',
            style: 'destructive',
            onPress: async () => {
              setFollowLoading(true);
              try {
                await UsersAPI.unfollowUser(userHandle);
                setFollowStatus('none');
                setFollowerCount(prev => Math.max(0, prev - 1));
              } catch (err: any) {
                console.error('[Follow] Failed to unfollow user:', err);
                Alert.alert('Error', err?.message || 'Failed to unfollow user');
              } finally {
                setFollowLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Send follow request
    setFollowLoading(true);
    try {
      const response = await UsersAPI.followUser(userHandle);

      // Check if response indicates a pending request or immediate follow
      // Look for various possible response formats
      let isPending = true; // Default to pending (requires approval)
      let isImmediate = false;

      if (response && typeof response === 'object') {
        // Check for explicit status field
        if ('status' in response) {
          isPending = response.status === 'pending' || response.status === 'requested';
          isImmediate = response.status === 'following' || response.status === 'accepted';
        }
        // Check for followStatus field
        else if ('followStatus' in response) {
          isPending = response.followStatus === 'pending' || response.followStatus === 'requested';
          isImmediate = response.followStatus === 'following' || response.followStatus === 'accepted';
        }
        // Check for isFollowing field
        else if ('isFollowing' in response) {
          isImmediate = response.isFollowing === true;
          isPending = !isImmediate;
        }
        // Check for pending field
        else if ('pending' in response) {
          isPending = response.pending === true;
          isImmediate = !isPending;
        }
      }

      if (isImmediate) {
        setFollowStatus('following');
        setFollowerCount(prev => prev + 1);
      } else {
        setFollowStatus('pending');
        // Don't increment follower count yet since it's pending
      }
    } catch (err: any) {
      console.error('[Follow] Failed to follow user:', err);
      Alert.alert('Error', err?.message || 'Failed to send follow request');
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, user?.handle, followStatus, followLoading]);

  const handleFollowersPress = React.useCallback(() => {
    if (user?.handle) {
      navigation.navigate('UserList', {
        handle: user.handle.replace(/^@/, ''),
        type: 'followers'
      });
    }
  }, [navigation, user?.handle]);

  const handleFollowingPress = React.useCallback(() => {
    if (user?.handle) {
      navigation.navigate('UserList', {
        handle: user.handle.replace(/^@/, ''),
        type: 'following'
      });
    }
  }, [navigation, user?.handle]);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing[4], alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.profileInfoRow}>
              <Avatar avatarKey={user?.avatarKey} size={56} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.handle}>{displayHandle}</Text>
                {user?.fullName && (
                  <Text style={styles.fullName}>{user.fullName}</Text>
                )}
                {user?.email && !isViewingSelf && (
                  <Text style={styles.email}>{user.email}</Text>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{posts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <TouchableOpacity style={styles.stat} onPress={handleFollowersPress}>
                <Text style={styles.statValue}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stat} onPress={handleFollowingPress}>
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            {!isViewingSelf && (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  followStatus === 'following' && styles.followingButton,
                  followStatus === 'pending' && styles.pendingButton,
                ]}
                onPress={handleFollowPress}
                disabled={followLoading}
              >
                <Text style={[
                  styles.followButtonText,
                  followStatus === 'following' && styles.followingButtonText,
                  followStatus === 'pending' && styles.pendingButtonText,
                ]}>
                  {followLoading ? 'Loading...' :
                   followStatus === 'following' ? 'Following' :
                   followStatus === 'pending' ? 'Pending' :
                   'Follow'}
                </Text>
              </TouchableOpacity>
            )}

            {posts.length > 0 && (
              <Text style={styles.sectionTitle}>{postsSectionTitle}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPressUser={(userId, userHandle) => {
              navigation.push('Profile', {
                userHandle: userHandle,
                userId: userId,
              });
            }}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isViewingSelf
                ? 'No posts yet'
                : 'This user has not posted yet'}
            </Text>
            {isViewingSelf && (
              <TouchableOpacity
                style={styles.createPostButton}
                onPress={() => navigation.navigate('ComposePost')}
              >
                <Text style={styles.createPostButtonText}>Create your first post</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing[3],
  },
  header: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    padding: spacing[3],
    ...shadows.base,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  profileTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  handle: {
    ...typography.styles.h4,
    color: colors.text.primary,
  },
  fullName: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing[0.5],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[4],
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.styles.h4,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  editButton: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  editButtonText: {
    color: colors.primary[500],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  headerSettingsButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  headerSettingsButtonText: {
    color: colors.primary[500],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  followButton: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignSelf: 'stretch',
    ...shadows.sm,
  },
  followButtonText: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  followingButton: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  followingButtonText: {
    color: colors.primary[500],
  },
  pendingButton: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.warning.main,
  },
  pendingButtonText: {
    color: colors.warning.main,
  },
  sectionTitle: {
    ...typography.styles.h5,
    marginTop: spacing[3],
    marginBottom: spacing[2],
    alignSelf: 'flex-start',
    color: colors.text.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  createPostButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  createPostButtonText: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
});
