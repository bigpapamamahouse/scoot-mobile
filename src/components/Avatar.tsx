
import React from 'react';
import { Image, View } from 'react-native';
import { optimizedMediaUrl, ImagePresets } from '../lib/media';
import { useTheme } from '../theme/ThemeContext';

const isAbsoluteUri = (value: string) => /^(https?:\/\/|data:|blob:)/i.test(value) || value.startsWith('//');

const resolveAvatarUri = (value?: string | null, size: number = 32): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (isAbsoluteUri(trimmed)) {
    const baseUrl = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    // Even for absolute URIs, try to optimize if it looks like a CDN URL
    return optimizedMediaUrl(baseUrl, getOptimizationForSize(size)) || baseUrl;
  }
  // Use optimized media URL with appropriate preset based on size
  return optimizedMediaUrl(trimmed, getOptimizationForSize(size));
};

// Helper to select the right image preset based on avatar size
const getOptimizationForSize = (size: number) => {
  if (size <= 64) return ImagePresets.avatarSmall;
  if (size <= 128) return ImagePresets.avatarMedium;
  return ImagePresets.avatarLarge;
};

const AvatarComponent = ({ avatarKey, size = 32 }: { avatarKey?: string | null; size?: number }) => {
  const { colors } = useTheme();
  const uri = resolveAvatarUri(avatarKey, size);
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
