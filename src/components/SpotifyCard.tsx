import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SpotifyEmbed, getSpotifyDeepLink, getSpotifyTypeLabel } from '../lib/spotify';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';

// Spotify brand green
const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_BLACK = '#191414';

interface SpotifyCardProps {
  embed: SpotifyEmbed;
  compact?: boolean;
}

export function SpotifyCard({ embed, compact = false }: SpotifyCardProps) {
  const { colors } = useTheme();
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const handlePress = async () => {
    const deepLink = getSpotifyDeepLink(embed.type, embed.spotifyId);
    const webUrl = embed.spotifyUrl;

    try {
      // Try to open Spotify app first
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        // Fallback to web URL
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('[SpotifyCard] Failed to open link:', error);
      // Last resort: try web URL
      try {
        await Linking.openURL(webUrl);
      } catch {
        // Silent fail
      }
    }
  };

  const typeLabel = getSpotifyTypeLabel(embed.type);
  const styles = React.useMemo(() => createStyles(colors, compact), [colors, compact]);

  if (compact) {
    // Compact horizontal layout for compose preview
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.compactImageContainer}>
          {!imageLoaded && !imageError && (
            <View style={styles.imagePlaceholder}>
              <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
            </View>
          )}
          {imageError ? (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons name="music" size={24} color={colors.text.tertiary} />
            </View>
          ) : (
            <Image
              source={{ uri: embed.thumbnailUrl }}
              style={[styles.compactImage, !imageLoaded && styles.imageHidden]}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {embed.title}
          </Text>
          <View style={styles.spotifyBadge}>
            <MaterialCommunityIcons name="spotify" size={14} color={SPOTIFY_GREEN} />
            <Text style={styles.compactTypeLabel}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.compactPlayButton}>
          <MaterialCommunityIcons name="play" size={16} color={SPOTIFY_BLACK} />
        </View>
      </TouchableOpacity>
    );
  }

  // Full card layout for feed display
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Large Album Art */}
      <View style={styles.imageContainer}>
        {!imageLoaded && !imageError && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="large" color={SPOTIFY_GREEN} />
          </View>
        )}
        {imageError ? (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="music" size={48} color={colors.text.tertiary} />
          </View>
        ) : (
          <Image
            source={{ uri: embed.thumbnailUrl }}
            style={[styles.image, !imageLoaded && styles.imageHidden]}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        )}

        {/* Play button overlay */}
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <MaterialCommunityIcons name="play" size={28} color={SPOTIFY_BLACK} />
          </View>
        </View>
      </View>

      {/* Info bar at bottom */}
      <View style={styles.infoBar}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {embed.title}
          </Text>
          <View style={styles.spotifyBadge}>
            <MaterialCommunityIcons name="spotify" size={16} color={SPOTIFY_GREEN} />
            <Text style={styles.typeLabel}>{typeLabel}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any, compact: boolean) =>
  StyleSheet.create({
    // Full card styles
    container: {
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      marginVertical: spacing[2],
      ...shadows.sm,
    },
    imageContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.neutral[200],
      position: 'relative',
    },
    imagePlaceholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.neutral[200],
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageHidden: {
      opacity: 0,
    },
    playButtonOverlay: {
      position: 'absolute',
      bottom: spacing[3],
      right: spacing[3],
    },
    playButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: SPOTIFY_GREEN,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.md,
    },
    infoBar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[3],
    },
    textContainer: {
      flex: 1,
    },
    title: {
      ...typography.styles.label,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      marginBottom: spacing[1],
    },
    spotifyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    typeLabel: {
      ...typography.styles.caption,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Compact styles (for compose preview)
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      marginVertical: spacing[2],
      ...shadows.sm,
    },
    compactImageContainer: {
      width: 56,
      height: 56,
      backgroundColor: colors.neutral[200],
    },
    compactImage: {
      width: '100%',
      height: '100%',
    },
    compactContent: {
      flex: 1,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    compactTitle: {
      ...typography.styles.label,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      marginBottom: spacing[1],
    },
    compactTypeLabel: {
      ...typography.styles.caption,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontSize: typography.fontSize.xs,
    },
    compactPlayButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: SPOTIFY_GREEN,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
  });

export default SpotifyCard;
