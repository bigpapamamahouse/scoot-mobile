/**
 * ScoopViewer Component
 * Full-screen viewer for a single scoop with progress bar and text overlays
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { Scoop, ScoopTextOverlay, ScoopFontFamily } from '../types';
import { useTheme, spacing, typography } from '../theme';
import { mediaUrlFromKey } from '../lib/media';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCOOP_DURATION = 5000; // 5 seconds for images
const VIDEO_MAX_DURATION = 10000; // 10 seconds max for videos

interface ScoopViewerProps {
  scoop: Scoop;
  isActive: boolean;
  onComplete: () => void;
  onPrevious: () => void;
  onClose: () => void;
  isPaused: boolean;
  onPauseChange: (paused: boolean) => void;
  isOwner?: boolean;
  onViewViewers?: () => void;
}

const getFontStyle = (fontFamily: ScoopFontFamily) => {
  switch (fontFamily) {
    case 'bold':
      return { fontWeight: '800' as const };
    case 'script':
      return { fontStyle: 'italic' as const, fontWeight: '500' as const };
    case 'mono':
      return { fontFamily: 'monospace' };
    default:
      return { fontWeight: '600' as const };
  }
};

export const ScoopViewer: React.FC<ScoopViewerProps> = ({
  scoop,
  isActive,
  onComplete,
  onPrevious,
  onClose,
  isPaused,
  onPauseChange,
  isOwner = false,
  onViewViewers,
}) => {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [mediaLoaded, setMediaLoaded] = React.useState(false);
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null);

  const mediaUrl = mediaUrlFromKey(scoop.mediaKey);
  const isVideo = scoop.mediaType === 'video';
  const duration = isVideo
    ? Math.min(videoDuration || VIDEO_MAX_DURATION, VIDEO_MAX_DURATION)
    : SCOOP_DURATION;

  // Create video player using expo-video hook
  const player = useVideoPlayer(isVideo && mediaUrl ? mediaUrl : null, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Start or pause progress animation
  useEffect(() => {
    if (!isActive || !mediaLoaded) {
      progressAnim.setValue(0);
      return;
    }

    if (isPaused) {
      animationRef.current?.stop();
      return;
    }

    // Get current progress value and calculate remaining duration
    let currentValue = 0;
    progressAnim.addListener(({ value }) => {
      currentValue = value;
    });

    const remainingDuration = duration * (1 - currentValue);

    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });

    return () => {
      progressAnim.removeAllListeners();
      animationRef.current?.stop();
    };
  }, [isActive, mediaLoaded, isPaused, duration, progressAnim, onComplete]);

  // Reset progress when scoop changes
  useEffect(() => {
    progressAnim.setValue(0);
    setMediaLoaded(false);
    setVideoDuration(null);
  }, [scoop.id, progressAnim]);

  // Listen to video player events
  useEffect(() => {
    if (!isVideo || !player) return;

    const statusSubscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setMediaLoaded(true);
        if (player.duration && !videoDuration) {
          setVideoDuration(player.duration * 1000); // Convert to ms
        }
      }
    });

    const endSubscription = player.addListener('playToEnd', () => {
      onComplete();
    });

    return () => {
      statusSubscription.remove();
      endSubscription.remove();
    };
  }, [isVideo, player, videoDuration, onComplete]);

  // Control video playback based on active/paused state
  useEffect(() => {
    if (!isVideo || !player) return;

    if (isActive && !isPaused && mediaLoaded) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isPaused, mediaLoaded, isVideo, player]);

  const handleMediaLoad = useCallback(() => {
    setMediaLoaded(true);
  }, []);

  const handlePress = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      const { locationX } = event.nativeEvent;
      const isLeftSide = locationX < SCREEN_WIDTH / 3;
      const isRightSide = locationX > (SCREEN_WIDTH * 2) / 3;

      if (isLeftSide) {
        onPrevious();
      } else if (isRightSide) {
        onComplete();
      }
      // Middle area does nothing on tap
    },
    [onPrevious, onComplete]
  );

  const handleLongPressIn = useCallback(() => {
    onPauseChange(true);
  }, [onPauseChange]);

  const handleLongPressOut = useCallback(() => {
    onPauseChange(false);
  }, [onPauseChange]);

  // Swipe up gesture for viewers (owner only)
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes when owner
        return isOwner && Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        onPauseChange(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward swipes (negative dy)
        if (gestureState.dy < 0) {
          swipeAnim.setValue(Math.abs(gestureState.dy));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        onPauseChange(false);
        // If swiped up enough, show viewers
        if (gestureState.dy < -100 && onViewViewers) {
          onViewViewers();
        }
        // Reset animation
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const timeAgo = React.useMemo(() => {
    const now = Date.now();
    const diff = now - scoop.createdAt;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1h ago';
    return `${hours}h ago`;
  }, [scoop.createdAt]);

  const timeRemaining = React.useMemo(() => {
    const now = Date.now();
    const remaining = scoop.expiresAt - now;
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }, [scoop.expiresAt]);

  return (
    <View style={styles.container}>
      {/* Media */}
      <TouchableWithoutFeedback
        onPress={handlePress}
        onLongPress={handleLongPressIn}
        onPressOut={handleLongPressOut}
        delayLongPress={200}
      >
        <View style={styles.mediaContainer}>
          {isVideo && player ? (
            <VideoView
              player={player}
              style={styles.media}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: mediaUrl || '' }}
              style={styles.media}
              resizeMode="cover"
              onLoad={handleMediaLoad}
            />
          )}

          {/* Loading indicator */}
          {!mediaLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* Text overlays */}
          {scoop.textOverlays?.map((overlay) => (
            <View
              key={overlay.id}
              style={[
                styles.textOverlay,
                {
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: [{ rotate: `${overlay.rotation || 0}deg` }],
                },
              ]}
            >
              <Text
                style={[
                  styles.overlayText,
                  getFontStyle(overlay.fontFamily),
                  {
                    fontSize: overlay.fontSize,
                    color: overlay.color,
                    backgroundColor: overlay.backgroundColor || 'transparent',
                  },
                ]}
              >
                {overlay.text}
              </Text>
            </View>
          ))}
        </View>
      </TouchableWithoutFeedback>

      {/* Top gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar avatarKey={scoop.avatarKey} size={36} />
          <View style={styles.userTextContainer}>
            <Text style={styles.handle}>{scoop.handle || 'User'}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </View>

        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </View>
        </TouchableWithoutFeedback>
      </View>

      {/* Footer for owner */}
      {isOwner && (
        <View style={styles.ownerFooter} {...panResponder.panHandlers}>
          {/* Time remaining */}
          <View style={styles.timeRemainingBadge}>
            <Ionicons name="time-outline" size={18} color="#fff" />
            <Text style={styles.timeRemainingText}>{timeRemaining}</Text>
          </View>

          {/* Swipe up hint */}
          <Animated.View style={[styles.swipeHint, { transform: [{ translateY: Animated.multiply(swipeAnim, -0.3) }] }]}>
            <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.swipeHintText}>
              {scoop.viewCount} {scoop.viewCount === 1 ? 'view' : 'views'}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mediaContainer: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: spacing[4],
    right: spacing[4],
  },
  progressBackground: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  header: {
    position: 'absolute',
    top: 65,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTextContainer: {
    marginLeft: spacing[2],
  },
  handle: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textOverlay: {
    position: 'absolute',
    maxWidth: '80%',
  },
  overlayText: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  ownerFooter: {
    position: 'absolute',
    bottom: 50,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
    gap: spacing[1],
  },
  timeRemainingText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  swipeHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 20,
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
});

export default ScoopViewer;
