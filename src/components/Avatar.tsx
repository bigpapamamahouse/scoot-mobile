
import React from 'react';
import { Image, View } from 'react-native';
import { mediaUrlFromKey } from '../lib/media';

const isAbsoluteUri = (value: string) => /^(https?:\/\/|data:|blob:)/i.test(value) || value.startsWith('//');

const resolveAvatarUri = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (isAbsoluteUri(trimmed)) {
    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  }
  return mediaUrlFromKey(trimmed);
};

export function Avatar({ avatarKey, size = 32 }: { avatarKey?: string | null; size?: number }){
  const uri = resolveAvatarUri(avatarKey);
  if (!uri) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#ddd' }} />;
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}
