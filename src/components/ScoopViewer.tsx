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
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  PanResponder,
  Modal,
  Pressable,
  Platform,
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
  onDelete?: () => void;
  onProgressUpdate?: (progress: number) => void;
  hideProgressBar?: boolean;
}

const getFontStyle = (fontFamily: ScoopFontFamily): any => {
  switch (fontFamily) {
    case 'bold':
      // Serif font
      return {
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        fontWeight: '400' as const,
      };
    case 'script':
      // Script/handwriting font
      return {
        fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
        fontWeight: '400' as const,
      };
    case 'mono':
      // Monospace font
      return {
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        fontWeight: '400' as const,
      };
    default:
      // Sans-serif (system default)
      return {
        fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
        fontWeight: '600' as const,
      };
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
  onDelete,
  onProgressUpdate,
  hideProgressBar = false,
}) => {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [mediaLoaded, setMediaLoaded] = React.useState(false);
  const [videoFrameRendered, setVideoFrameRendered] = React.useState(false);
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null);
  const [showMenu, setShowMenu] = React.useState(false);

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
      onProgressUpdate?.(0);
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
      onProgressUpdate?.(value);
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
  }, [isActive, mediaLoaded, isPaused, duration, progressAnim, onComplete, onProgressUpdate]);

  // Reset progress when scoop changes
  useEffect(() => {
    progressAnim.setValue(0);
    setMediaLoaded(false);
    setVideoFrameRendered(false);
    setVideoDuration(null);
  }, [scoop.id, progressAnim]);

  // Listen to video player events
  useEffect(() => {
    if (!isVideo || !player) return;

    console.log('[ScoopViewer] Setting up video player for:', mediaUrl);

    let frameCheckInterval: ReturnType<typeof setInterval> | null = null;

    const statusSubscription = player.addListener('statusChange', (event) => {
      console.log('[ScoopViewer] Video status:', event.status);
      if (event.status === 'readyToPlay') {
        setMediaLoaded(true);
        if (player.duration && !videoDuration) {
          setVideoDuration(player.duration * 1000); // Convert to ms
        }
      } else if (event.status === 'error') {
        console.error('[ScoopViewer] Video error:', event.error);
      }
    });

    // Poll for currentTime > 0 to know when video has actually started rendering frames
    frameCheckInterval = setInterval(() => {
      if (player.currentTime > 0) {
        console.log('[ScoopViewer] Video currentTime > 0, frame rendered');
        setVideoFrameRendered(true);
        if (frameCheckInterval) {
          clearInterval(frameCheckInterval);
          frameCheckInterval = null;
        }
      }
    }, 16); // Check every frame (~60fps)

    const endSubscription = player.addListener('playToEnd', () => {
      onComplete();
    });

    return () => {
      statusSubscription.remove();
      endSubscription.remove();
      if (frameCheckInterval) {
        clearInterval(frameCheckInterval);
      }
    };
  }, [isVideo, player, videoDuration, onComplete, mediaUrl]);

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

  // Swipe up gesture for viewers (owner only) - works from anywhere on screen
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;
  const onViewViewersRef = useRef(onViewViewers);
  onViewViewersRef.current = onViewViewers;
  const onPauseChangeRef = useRef(onPauseChange);
  onPauseChangeRef.current = onPauseChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to upward vertical swipes when owner
        return isOwnerRef.current && gestureState.dy < -10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        onPauseChangeRef.current?.(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward swipes (negative dy)
        if (gestureState.dy < 0) {
          swipeAnim.setValue(Math.abs(gestureState.dy));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        onPauseChangeRef.current?.(false);
        console.log('[ScoopViewer] Swipe release - dy:', gestureState.dy, 'hasCallback:', !!onViewViewersRef.current);
        // If swiped up enough, show viewers
        if (gestureState.dy < -100 && onViewViewersRef.current) {
          console.log('[ScoopViewer] Triggering onViewViewers');
          onViewViewersRef.current();
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
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours === 1) return '1h ago';
    return `${hours}h ago`;
  }, [scoop.createdAt]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
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

          {/* Loading indicator - for videos, keep showing until first frame renders */}
          {(!mediaLoaded || (isVideo && !videoFrameRendered)) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* Text overlays - only show after media loads (and first frame renders for videos) */}
          {mediaLoaded && (!isVideo || videoFrameRendered) && scoop.textOverlays?.map((overlay) => (
            <View
              key={overlay.id}
              style={[
                styles.textOverlay,
                {
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: [
                    { scale: overlay.scale || 1 },
                    { rotate: `${overlay.rotation || 0}deg` },
                  ],
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

      {/* Progress bar - hidden when using external progress bars */}
      {!hideProgressBar && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar avatarKey={scoop.avatarKey} size={36} />
          <View style={styles.userTextContainer}>
            <Text style={styles.handle}>{scoop.handle || 'User'}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </View>

        <View style={styles.headerButtons}>
          {/* 3-dot menu for owner */}
          {isOwner && onDelete && (
            <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </View>

      {/* Menu modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                onDelete?.();
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={styles.menuItemTextDanger}>Delete Scoop</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Footer for owner - swipe up hint centered */}
      {isOwner && (
        <View style={styles.ownerFooter}>
          <Animated.View style={[styles.swipeHint, { transform: [{ translateY: Animated.multiply(swipeAnim, -0.3) }] }]}>
            <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.swipeHintText}>
              {scoop.viewCount ?? 0} {scoop.viewCount === 1 ? 'view' : 'views'}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 110,
    paddingRight: spacing[4],
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  menuItemTextDanger: {
    fontSize: typography.fontSize.base,
    color: '#FF3B30',
    fontWeight: '500',
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
    alignItems: 'center',
    justifyContent: 'center',
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
