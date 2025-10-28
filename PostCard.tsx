
import React from 'react';
import { View, Text, Image } from 'react-native';
import { Post } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';

export default function PostCard({ post }: { post: Post }){
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar avatarKey={post.avatarKey} size={28} />
        <Text style={{ fontWeight: '600' }}>@{post.handle || post.userId.slice(0,8)}</Text>
        <Text style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
          {new Date(post.createdAt).toLocaleString()}
        </Text>
      </View>
      {post.imageKey ? (
        <Image source={{ uri: mediaUrlFromKey(post.imageKey)! }} style={{ width: '100%', height: 200, borderRadius: 8 }} />
      ) : null}
      <Text>{post.text}</Text>
    </View>
  );
}
