
import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { PostsAPI, UsersAPI } from '../api';
import PostCard from '../components/PostCard';
import { Post } from '../types';

export default function FeedScreen(){
  const [items, setItems] = React.useState<Post[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async ()=>{
    try {
      const f = await PostsAPI.getFeed();
      setItems(f.items || []);
    } catch (e: any) {
      console.warn('feed failed', e?.message || String(e));
    }
  }, []);

  React.useEffect(()=>{ load(); }, [load]);

  return (
    <FlatList
      style={{ padding: 12 }}
      data={items}
      keyExtractor={(it)=>it.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); load().finally(()=>setRefreshing(false)); }} />}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 40 }}>No posts yet.</Text>}
    />
  );
}
