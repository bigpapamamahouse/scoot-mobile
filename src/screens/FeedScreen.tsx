
import React from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { PostsAPI } from '../api';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { resolveHandle } from '../lib/resolveHandle';

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
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ padding: 12 }}
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
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); load().finally(()=>setRefreshing(false)); }} />}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 40 }}>No posts yet.</Text>}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ComposePost')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
});
