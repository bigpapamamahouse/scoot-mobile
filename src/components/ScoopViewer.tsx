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
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
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
  const videoRef = useRef<Video>(null);
  const [mediaLoaded, setMediaLoaded] = React.useState(false);
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null);

  const mediaUrl = mediaUrlFromKey(scoop.mediaKey);
  const isVideo = scoop.mediaType === 'video';
  const duration = isVideo
    ? Math.min(videoDuration || VIDEO_MAX_DURATION, VIDEO_MAX_DURATION)
    : SCOOP_DURATION;

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

  // Handle video playback status
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    if (status.durationMillis && !videoDuration) {
      setVideoDuration(status.durationMillis);
    }

    if (status.didJustFinish) {
      onComplete();
    }
  }, [videoDuration, onComplete]);

  // Control video playback based on active/paused state
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

    if (isActive && !isPaused && mediaLoaded) {
      videoRef.current.playAsync();
    } else {
      videoRef.current.pauseAsync();
    }
  }, [isActive, isPaused, mediaLoaded, isVideo]);

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
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl || '' }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping={false}
              onLoad={handleMediaLoad}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              isMuted={false}
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
      {isOwner && onViewViewers && (
        <TouchableWithoutFeedback onPress={onViewViewers}>
          <View style={styles.viewersButton}>
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={styles.viewersText}>
              {scoop.viewCount} {scoop.viewCount === 1 ? 'view' : 'views'}
            </Text>
          </View>
        </TouchableWithoutFeedback>
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
  viewersButton: {
    position: 'absolute',
    bottom: 50,
    left: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
  },
  viewersText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing[2],
  },
});

export default ScoopViewer;
