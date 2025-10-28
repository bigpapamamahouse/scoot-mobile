
import React from 'react';
import { Image, View } from 'react-native';
import { mediaUrlFromKey } from '../lib/media';

export function Avatar({ avatarKey, size = 32 }: { avatarKey?: string | null; size?: number }){
  const uri = avatarKey ? mediaUrlFromKey(avatarKey) : undefined;
  if (!uri) return <View style={{ width: size, height: size, borderRadius: size/2, backgroundColor: '#ddd' }} />;
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size/2 }} />;
}
