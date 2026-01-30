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
import { Ionicons } from '@expo/vector-icons';
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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Album Art */}
      <View style={styles.imageContainer}>
        {!imageLoaded && !imageError && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
          </View>
        )}
        {imageError ? (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="musical-notes" size={compact ? 24 : 32} color={colors.text.tertiary} />
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
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {embed.title}
          </Text>
          <View style={styles.subtitleRow}>
            <View style={styles.spotifyBadge}>
              <Ionicons name="logo-spotify" size={12} color={SPOTIFY_GREEN} />
              <Text style={styles.typeLabel}>{typeLabel}</Text>
            </View>
          </View>
        </View>

        {/* Play indicator */}
        <View style={styles.playButton}>
          <Ionicons name="play" size={compact ? 16 : 20} color={SPOTIFY_BLACK} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any, compact: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      marginVertical: spacing[2],
      ...shadows.sm,
    },
    imageContainer: {
      width: compact ? 56 : 80,
      height: compact ? 56 : 80,
      backgroundColor: colors.neutral[200],
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
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    textContainer: {
      flex: 1,
      marginRight: spacing[2],
    },
    title: {
      ...typography.styles.label,
      fontSize: compact ? typography.fontSize.sm : typography.fontSize.base,
      color: colors.text.primary,
      marginBottom: spacing[1],
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    playButton: {
      width: compact ? 32 : 40,
      height: compact ? 32 : 40,
      borderRadius: compact ? 16 : 20,
      backgroundColor: SPOTIFY_GREEN,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.sm,
    },
  });

export default SpotifyCard;
