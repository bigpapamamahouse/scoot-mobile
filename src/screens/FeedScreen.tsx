
import React from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PostsAPI } from '../api';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { resolveHandle } from '../lib/resolveHandle';
import { ModernScreen } from '../components/ui/ModernScreen';
import { GlassCard } from '../components/ui/GlassCard';
import { palette } from '../theme/colors';
import { useCurrentUser } from '../hooks/useCurrentUser';

export default function FeedScreen({ navigation }: any){
  const [items, setItems] = React.useState<Post[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const { currentUser } = useCurrentUser();

  const openProfile = React.useCallback(
    (post: Post) => {
      const anyPost: any = post;
      const handle = resolveHandle(anyPost);
      const userIdCandidate: unknown =
        anyPost?.userId ||
        anyPost?.user?.id ||
        anyPost?.authorId ||
        anyPost?.author?.id ||
        anyPost?.createdById ||
        anyPost?.profileId;

      const userId =
        typeof userIdCandidate === 'string' && userIdCandidate.trim()
          ? userIdCandidate.trim()
          : undefined;

      navigation.push('Profile', {
        userHandle: handle,
        userId: userId,
      });
    },
    [navigation]
  );

  const load = React.useCallback(async ()=>{
    try {
      const f = await PostsAPI.getFeed();
      setItems(f.items || []);
    } catch (e: any) {
      console.warn('feed failed', e?.message || String(e));
    }
  }, []);

  const handlePostUpdated = React.useCallback((updatedPost: Post) => {
    setItems((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  }, []);

  const handlePostDeleted = React.useCallback((postId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  React.useEffect(()=>{ load(); }, [load]);

  // Refresh feed when screen comes into focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const greeting = React.useMemo(() => {
    if (!currentUser) {
      return 'Welcome back';
    }
    if (currentUser.fullName) {
      const firstName = currentUser.fullName.split(' ')[0];
      return firstName ? `Hi, ${firstName}` : 'Hi there';
    }
    if (currentUser.handle) {
      return `Hi, @${currentUser.handle}`;
    }
    return 'Hi there';
  }, [currentUser]);

  return (
    <ModernScreen edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(it)=>it.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('Post', { post: item })}
            onPressAuthor={() => openProfile(item)}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.textSecondary}
            progressBackgroundColor={'rgba(15,23,42,0.65)'}
            colors={[palette.accent, palette.accentSecondary]}
            onRefresh={() => {
              setRefreshing(true);
              load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.heroContainer}>
            <GlassCard contentStyle={styles.heroContent}>
              <Text style={styles.heroGreeting}>{greeting}</Text>
              <Text style={styles.heroSubtext}>What's on your mind?</Text>
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => navigation.navigate('ComposePost')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[palette.accent, palette.accentSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.heroButtonText}>Create a post</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No posts yet. Be the first to share something today.
          </Text>
        }
        ListFooterComponent={<View style={{ height: 120 }} />}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ComposePost')}
      >
        <LinearGradient
          colors={[palette.accent, palette.accentSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 0,
    gap: 18,
  },
  heroContainer: {
    marginBottom: 12,
  },
  heroContent: {
    padding: 18,
  },
  heroGreeting: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  heroSubtext: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroButton: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 18,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  fabIcon: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
  separator: {
    height: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textSecondary,
    marginTop: 40,
    fontSize: 15,
  },
});
