
import React from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { PostsAPI } from '../api';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { resolveHandle } from '../lib/resolveHandle';
import { IconButton } from '../components/ui';
import { colors, spacing, shadows } from '../theme';

export default function FeedScreen({ navigation }: any){
  const [items, setItems] = React.useState<Post[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

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

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
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
        ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={()=>{ setRefreshing(true); load().finally(()=>setRefreshing(false)); }}
            tintColor={colors.primary[500]}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No posts yet.</Text>}
      />

      {/* Floating Action Button with glass morphism */}
      <IconButton
        icon="add"
        onPress={() => navigation.navigate('ComposePost')}
        variant="glass"
        size="lg"
        color={colors.primary[600]}
        style={styles.fab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  list: {
    padding: spacing[3],
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: spacing[10],
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[5],
    ...shadows.lg,
  },
});
