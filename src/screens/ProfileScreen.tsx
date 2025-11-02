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
  const [user, setUser] = React.useState<ProfileIdentity | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [viewer, setViewer] = React.useState<User | null>(null);
  const [followerCount, setFollowerCount] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState(0);
  const [followStatus, setFollowStatus] = React.useState<'none' | 'pending' | 'following'>('none');
  const [followLoading, setFollowLoading] = React.useState(false);

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
    async (options?: { skipSpinner?: boolean }) => {
      console.log('[ProfileScreen] load() called, skipSpinner:', options?.skipSpinner);
      if (!options?.skipSpinner) {
        setLoading(true);
      }

      const params = (route?.params ?? {}) as Record<string, unknown>;
      const paramHandleCandidates = [
        params.userHandle,
        params.handle,
        params.username,
      ];
      const paramUserIdCandidates = [params.userId, params.id, params.profileId];

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

      let requestedHandle: string | null = null;
      for (const candidate of paramHandleCandidates) {
        requestedHandle = normalizeHandle(candidate);
        if (requestedHandle) break;
      }

      let requestedUserId: string | null = null;
      for (const candidate of paramUserIdCandidates) {
        requestedUserId = normalizeId(candidate);
        if (requestedUserId) break;
      }

      let targetIdentity: ProfileIdentity | null = null;

      try {
        let currentUser: User | null = null;
        try {
          currentUser = await UsersAPI.me();
          console.log('[ProfileScreen] currentUser from me():', currentUser);
          console.log('[ProfileScreen] currentUser avatarKey:', currentUser?.avatarKey);
          console.log('[ProfileScreen] currentUser?.id:', currentUser?.id);
          console.log('[ProfileScreen] currentUser?.userId:', (currentUser as any)?.userId);
        } catch (viewerError: any) {
          console.warn(
            'Failed to load signed-in user profile:',
            viewerError?.message || String(viewerError)
          );
        }
        setViewer(currentUser);

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
        console.log('[Profile] viewerId after me():', viewerId);

        const isSelfRequest = (() => {
          if (!targetHandle && !targetUserId) {
            return true;
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
            console.log('[Profile] Fetching user by identity:', { handle: targetHandle, userId: targetUserId });
            const fetched = await UsersAPI.getUserByIdentity({
              handle: targetHandle,
              userId: targetUserId,
            });
            console.log('[Profile] getUserByIdentity returned:', fetched);
            if (fetched) {
              targetIdentity = {
                id: fetched.id ?? null,
                handle: fetched.handle ?? null,
                avatarKey: fetched.avatarKey ?? null,
                email: fetched.email ?? null,
                fullName: fetched.fullName ?? null,
                createdAt: fetched.createdAt ?? null,
              };
              console.log('[Profile] Created targetIdentity:', targetIdentity);
              if (fetched.handle) {
                targetHandle = fetched.handle.replace(/^@/, '').trim() || targetHandle;
              }
              if (fetched.id) {
                targetUserId = fetched.id;
                console.log('[Profile] Set targetUserId:', targetUserId);
              } else {
                console.warn('[Profile] Fetched user has no ID!');
              }
            } else {
              console.warn('[Profile] getUserByIdentity returned null/undefined');
            }
          } catch (err: any) {
            console.warn(
              'Failed to load requested profile:',
              err?.message || String(err)
            );
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

        const postsData = await PostsAPI.getUserPosts({
          handle: targetHandle,
          userId: targetUserId,
        });
        const normalizedPosts = resolvePosts(postsData);
        const filteredPosts = filterPostsForUser(normalizedPosts, {
          id: targetUserId,
          handle: targetHandle,
        });
        if (filteredPosts.length !== normalizedPosts.length) {
          console.debug(
            'Filtered profile posts to target user',
            normalizedPosts.length - filteredPosts.length,
            'items removed'
          );
        }
        if (!filteredPosts.length && postsData && !Array.isArray(postsData)) {
          console.warn('Unrecognized user posts response shape', postsData);
        }
        setPosts(filteredPosts);

        let resolvedIdentity = targetIdentity;
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
          console.log('[Profile] Derived identity from posts:', resolvedIdentity);
        }

        const finalUserToSet = resolvedIdentity ?? targetIdentity ?? null;
        console.log('[ProfileScreen] Setting user state:', finalUserToSet);
        console.log('[ProfileScreen] User avatarKey being set:', finalUserToSet?.avatarKey);
        console.log('[ProfileScreen] resolvedIdentity:', resolvedIdentity);
        console.log('[ProfileScreen] targetIdentity:', targetIdentity);
        setUser(finalUserToSet);

        // Load follower/following counts and follow status
        const finalIdentity = resolvedIdentity ?? targetIdentity;
        const userHandle = finalIdentity?.handle?.replace(/^@/, '').trim();
        if (userHandle) {
          try {
            // Fetch fresh user profile data to get follow status
            console.log('[Profile] Fetching user profile for follow status:', userHandle);
            const profileData = await UsersAPI.getUser(userHandle);
            console.log('[Profile] Profile data:', profileData);

            const followersData = await UsersAPI.listFollowers(userHandle);
            const followers = Array.isArray(followersData) ? followersData :
              (followersData?.items || followersData?.followers || []);
            setFollowerCount(followers.length);

            const followingData = await UsersAPI.listFollowing(userHandle);
            const following = Array.isArray(followingData) ? followingData :
              (followingData?.items || followingData?.following || []);
            setFollowingCount(following.length);

            // Check follow status from profile data
            // Use viewerId from earlier in the function (it's in the same scope)
            console.log('[Profile] Checking follow status - isSelfRequest:', isSelfRequest, 'viewerId:', viewerId);
            if (!isSelfRequest) {
              console.log('[Profile] Entered follow status check block');
              // Use followStatus and isFollowPending from API if available
              if (profileData && typeof profileData === 'object') {
                console.log('[Profile] profileData is valid object');
                if ('isFollowPending' in profileData && profileData.isFollowPending === true) {
                  console.log('[Profile] Follow status: pending (from API)');
                  setFollowStatus('pending');
                } else if ('followStatus' in profileData) {
                  const status = profileData.followStatus;
                  console.log('[Profile] followStatus field found:', status);
                  if (status === 'pending' || status === 'requested') {
                    console.log('[Profile] Follow status: pending (from followStatus)');
                    setFollowStatus('pending');
                  } else if (status === 'following' || status === 'accepted') {
                    console.log('[Profile] Follow status: following (from followStatus)');
                    setFollowStatus('following');
                  } else {
                    console.log('[Profile] Follow status: none (from followStatus)');
                    setFollowStatus('none');
                  }
                } else if ('isFollowing' in profileData && profileData.isFollowing === true) {
                  console.log('[Profile] Follow status: following (from isFollowing)');
                  setFollowStatus('following');
                } else {
                  // Fallback: check if in followers list (requires viewerId)
                  const isUserFollowing = viewerId
                    ? followers.some((f: any) => f.id === viewerId)
                    : false;
                  console.log('[Profile] Follow status: fallback check -', isUserFollowing ? 'following' : 'none');
                  setFollowStatus(isUserFollowing ? 'following' : 'none');
                }
              } else {
                console.log('[Profile] profileData is not a valid object');
                // Fallback: check if in followers list (requires viewerId)
                const isUserFollowing = viewerId
                  ? followers.some((f: any) => f.id === viewerId)
                  : false;
                setFollowStatus(isUserFollowing ? 'following' : 'none');
              }
            } else {
              console.log('[Profile] Skipped follow status check - isSelfRequest:', isSelfRequest, 'viewerId:', viewerId);
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
    [deriveIdentityFromPosts, filterPostsForUser, resolvePosts, route?.params]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    load({ skipSpinner: true }).finally(() => setRefreshing(false));
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
    if (!viewer || !user) return false;

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

    const viewerId = normalizeId((viewer as any)?.id) || normalizeId((viewer as any)?.userId);
    const userId = normalizeId((user as any)?.id) || normalizeId((user as any)?.userId);

    if (viewerId && userId && viewerId === userId) {
      return true;
    }

    const viewerHandle = normalizeHandle((viewer as any)?.handle);
    const userHandle = normalizeHandle((user as any)?.handle);

    if (viewerHandle && userHandle && viewerHandle === userHandle) {
      return true;
    }

    return false;
  }, [user, viewer]);

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
        variant="outline"
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
    console.log('[Follow] Button pressed');
    console.log('[Follow] User:', user);
    console.log('[Follow] User handle:', user?.handle);
    console.log('[Follow] Follow status:', followStatus);
    console.log('[Follow] Follow loading:', followLoading);

    const userHandle = user?.handle?.replace(/^@/, '');
    if (!userHandle || followLoading) {
      console.log('[Follow] Blocked - userHandle:', userHandle, 'followLoading:', followLoading);
      return;
    }

    // If already following, show confirmation dialog
    if (followStatus === 'following') {
      console.log('[Follow] Already following, showing unfollow dialog');
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
              console.log('[Follow] Unfollowing user:', userHandle);
              setFollowLoading(true);
              try {
                await UsersAPI.unfollowUser(userHandle);
                console.log('[Follow] Unfollow successful');
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
    console.log('[Follow] Sending follow request to user:', userHandle);
    setFollowLoading(true);
    try {
      const response = await UsersAPI.followUser(userHandle);
      console.log('[Follow] Follow response:', response);
      console.log('[Follow] Follow response type:', typeof response);
      if (response && typeof response === 'object') {
        console.log('[Follow] Follow response keys:', Object.keys(response));
      }

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
        console.log('[Follow] Status: following (immediate/auto-accepted)');
        setFollowStatus('following');
        setFollowerCount(prev => prev + 1);
      } else {
        console.log('[Follow] Status: pending (requires approval)');
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
        ListHeaderComponent={
          <View style={styles.header}>
            <Avatar avatarKey={user?.avatarKey} size={80} />
            <Text style={styles.handle}>{displayHandle}</Text>
            {user?.fullName && (
              <Text style={styles.fullName}>{user.fullName}</Text>
            )}
            {user?.email && (
              <Text style={styles.email}>{user.email}</Text>
            )}

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
    alignItems: 'center',
    paddingVertical: spacing[5],
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    padding: spacing[4],
    ...shadows.base,
  },
  handle: {
    ...typography.styles.h4,
    marginTop: spacing[3],
    color: colors.text.primary,
  },
  fullName: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing[1],
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing[5],
    gap: spacing[8],
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
    marginTop: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    ...shadows.sm,
  },
  followButtonText: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
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
    marginTop: spacing[6],
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
