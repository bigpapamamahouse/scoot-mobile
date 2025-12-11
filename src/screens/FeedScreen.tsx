
import React from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { PostsAPI, ReactionsAPI } from '../api';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { resolveHandle } from '../lib/resolveHandle';
import { IconButton } from '../components/ui';
import { useTheme, spacing, shadows } from '../theme';
import { cache, CacheKeys, CacheTTL } from '../lib/cache';

const POSTS_PER_PAGE = 20;

export default function FeedScreen({ navigation }: any){
  const { colors } = useTheme();
  const [items, setItems] = React.useState<Post[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [reactionsMap, setReactionsMap] = React.useState<Map<string, any>>(new Map());

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

  const load = React.useCallback(async (pageNum: number = 0, append: boolean = false)=>{
    try {
      // Try to load from cache first for instant display
      if (!append && pageNum === 0) {
        const cachedData = cache.get<Post[]>(CacheKeys.feed(0));
        if (cachedData && cachedData.length > 0) {
          console.log('[FeedScreen] Loading from cache:', cachedData.length, 'posts');
          setItems(cachedData);
        }
      }

      // Fetch fresh data from API with pagination
      const offset = pageNum * POSTS_PER_PAGE;
      const f = await PostsAPI.getFeed({
        limit: POSTS_PER_PAGE,
        offset
      });
      const newItems = f.items || f || [];

      // Batch load reactions for all posts (prevents N+1 problem)
      if (newItems.length > 0) {
        const postIds = newItems.map((post: Post) => post.id);
        try {
          const batchedReactions = await ReactionsAPI.getBatchedReactions(postIds);
          setReactionsMap((prev) => {
            const updated = new Map(prev);
            batchedReactions.forEach((reactions, postId) => {
              updated.set(postId, reactions);
            });
            return updated;
          });
        } catch (reactionsError) {
          console.warn('[FeedScreen] Failed to load batched reactions:', reactionsError);
          // Continue without reactions - PostCard will handle missing data
        }
      }

      // Update state with deduplication
      if (append) {
        setItems((prev) => {
          // Create a Set of existing post IDs for O(1) lookup
          const existingIds = new Set(prev.map(p => p.id));
          // Filter out any new items that already exist
          const uniqueNewItems = newItems.filter((item: Post) => !existingIds.has(item.id));
          return [...prev, ...uniqueNewItems];
        });
      } else {
        setItems(newItems);
        // Cache the first page for instant loads
        if (pageNum === 0 && newItems.length > 0) {
          cache.set(CacheKeys.feed(0), newItems, CacheTTL.feed);
        }
      }

      // Check if there are more posts to load
      setHasMore(newItems.length >= POSTS_PER_PAGE);
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

  const handleReactionsUpdated = React.useCallback((postId: string, reactions: any) => {
    setReactionsMap((prev) => {
      const updated = new Map(prev);
      updated.set(postId, reactions);
      return updated;
    });
  }, []);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;

    console.log('[FeedScreen] Loading more posts, page:', page + 1);
    setLoadingMore(true);
    const nextPage = page + 1;
    await load(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await load(0, false);
    setRefreshing(false);
  }, [load]);

  React.useEffect(()=>{ load(0); }, [load]);

  // Refresh feed when screen comes into focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setPage(0);
      setHasMore(true);
      load(0);
    });
    return unsubscribe;
  }, [navigation, load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.secondary }}>
      <FlatList
        style={{ padding: spacing[3] }}
        data={items}
        keyExtractor={(it)=>it.id}
        initialNumToRender={10}
        windowSize={21}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('Post', { post: item })}
            onPressAuthor={() => openProfile(item)}
            onPressUser={(userId, userHandle) => {
              navigation.push('Profile', {
                userHandle: userHandle,
                userId: userId,
              });
            }}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
            initialReactions={reactionsMap.get(item.id)}
            onReactionsUpdated={(reactions) => handleReactionsUpdated(item.id, reactions)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
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
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.text.secondary, marginTop: spacing[10], fontSize: 16 }}>
            No posts yet.
          </Text>
        }
      />

      {/* Floating Action Button - Apple-style liquid glass */}
      <IconButton
        icon="create-outline"
        onPress={() => navigation.navigate('ComposePost')}
        variant="glass"
        size="lg"
        color={colors.primary[500]}
        style={{
          position: 'absolute',
          right: spacing[5],
          bottom: spacing[5],
        }}
      />
    </View>
  );
}
