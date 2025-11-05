
import React from 'react';
import { Image, View } from 'react-native';
import { mediaUrlFromKey } from '../lib/media';
import { useTheme } from '../theme/ThemeContext';

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

const AvatarComponent = ({ avatarKey, size = 32 }: { avatarKey?: string | null; size?: number }) => {
  const { colors } = useTheme();
  const uri = resolveAvatarUri(avatarKey);
  if (!uri) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.neutral[300] }} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={(error) => console.error('[Avatar] Image load error:', error.nativeEvent)}
    />
  );
};

// Memoize Avatar to prevent unnecessary re-renders
export const Avatar = React.memo(AvatarComponent, (prevProps, nextProps) => {
  return prevProps.avatarKey === nextProps.avatarKey && prevProps.size === nextProps.size;
});
