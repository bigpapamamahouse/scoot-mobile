import React from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UsersAPI, PostsAPI } from '../api';
import { User, Post } from '../types';
import PostCard from '../components/PostCard';
import { Avatar } from '../components/Avatar';

export default function ProfileScreen({ navigation, route }: any) {
  const [user, setUser] = React.useState<User | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [viewer, setViewer] = React.useState<User | null>(null);

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

      const normalizeIdCandidate = (value: unknown) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            return trimmed;
          }
        }
        return null;
      };

      const normalizeHandleCandidate = (value: unknown) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            return trimmed.replace(/^@/, '').toLowerCase();
          }
        }
        return null;
      };

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
    []
  );

  const load = React.useCallback(
    async (options?: { skipSpinner?: boolean }) => {
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

      try {
        let currentUser: User | null = null;
        try {
          currentUser = await UsersAPI.me();
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

        if (!targetHandle && currentUser?.handle) {
          targetHandle = currentUser.handle.replace(/^@/, '').trim() || null;
        }

        if (!targetUserId && currentUser?.id) {
          targetUserId = currentUser.id.trim();
        }

        const normalizedTargetHandle =
          targetHandle?.toLowerCase() || null;

        let targetUser: User | null = null;

        if (
          currentUser &&
          ((normalizedTargetHandle &&
            viewerHandle &&
            normalizedTargetHandle === viewerHandle) ||
            (targetUserId && currentUser.id === targetUserId))
        ) {
          targetUser = currentUser;
        }

        if (!targetUser && (targetHandle || targetUserId)) {
          try {
            const fetched = await UsersAPI.getUserByIdentity({
              handle: targetHandle,
              userId: targetUserId,
            });
            if (fetched) {
              targetUser = fetched;
              if (fetched.handle) {
                targetHandle = fetched.handle.replace(/^@/, '').trim() || targetHandle;
              }
              if (fetched.id) {
                targetUserId = fetched.id;
              }
            }
          } catch (err: any) {
            console.warn(
              'Failed to load requested profile:',
              err?.message || String(err)
            );
          }
        }

        if (!targetUser && currentUser) {
          targetUser = currentUser;
        }

        if (!targetUser) {
          throw new Error('Unable to resolve profile user');
        }

        setUser(targetUser);

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
      } catch (e: any) {
        console.warn('Failed to load profile:', e?.message || String(e));
        if (!options?.skipSpinner) {
          setUser(null);
          setPosts([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [filterPostsForUser, resolvePosts, route?.params]
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

  const isViewingSelf = React.useMemo(() => {
    if (!viewer || !user) return false;
    return viewer.id === user.id;
  }, [user, viewer]);

  React.useEffect(() => {
    if (!navigation?.setOptions) return;
    if (isViewingSelf) {
      navigation.setOptions({ title: 'Profile' });
    } else if (user?.handle) {
      navigation.setOptions({ title: `@${user.handle}` });
    } else if (user?.fullName) {
      navigation.setOptions({ title: user.fullName });
    } else if (user?.id) {
      navigation.setOptions({ title: user.id.slice(0, 8) });
    }
  }, [isViewingSelf, navigation, user?.fullName, user?.handle, user?.id]);

  const displayHandle = React.useMemo(() => {
    if (user?.handle) return `@${user.handle}`;
    if (user?.id) return `@${user.id.slice(0, 8)}`;
    return '@Unknown';
  }, [user]);

  const postsSectionTitle = React.useMemo(() => {
    if (isViewingSelf) return 'Your Posts';
    const base = user?.handle || user?.fullName || user?.id?.slice(0, 8) || 'User';
    if (!base) return 'Posts';
    const needsApostrophe = /s$/i.test(base);
    return `${base}${needsApostrophe ? "'" : "'s"} Posts`;
  }, [isViewingSelf, user?.fullName, user?.handle, user?.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
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
            </View>

            {isViewingSelf && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}

            {posts.length > 0 && (
              <Text style={styles.sectionTitle}>{postsSectionTitle}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
  },
  handle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  email: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 32,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  editButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  editButtonText: {
    color: '#2196f3',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
    textAlign: 'center',
  },
  createPostButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createPostButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
