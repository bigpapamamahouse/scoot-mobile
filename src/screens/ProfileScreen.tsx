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

export default function ProfileScreen({ navigation }: any) {
  const [user, setUser] = React.useState<User | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

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

  const load = React.useCallback(async () => {
    try {
      // Load current user info
      const userData = await UsersAPI.me();
      setUser(userData);

      // Load user's posts
      const postsData = await PostsAPI.getUserPosts({
        handle: userData?.handle,
        userId: userData?.id,
      });
      const normalizedPosts = resolvePosts(postsData);
      const filteredPosts = filterPostsForUser(normalizedPosts, {
        id: userData?.id,
        handle: userData?.handle,
      });
      if (filteredPosts.length !== normalizedPosts.length) {
        console.debug(
          'Filtered profile posts to current user',
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
    } finally {
      setLoading(false);
    }
  }, [filterPostsForUser, resolvePosts]);

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
    load().finally(() => setRefreshing(false));
  }, [load]);

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
            <Text style={styles.handle}>
              @{user?.handle || user?.id?.slice(0, 8) || 'Unknown'}
            </Text>
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

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            {posts.length > 0 && (
              <Text style={styles.sectionTitle}>Your Posts</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => navigation.navigate('ComposePost')}
            >
              <Text style={styles.createPostButtonText}>Create your first post</Text>
            </TouchableOpacity>
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
