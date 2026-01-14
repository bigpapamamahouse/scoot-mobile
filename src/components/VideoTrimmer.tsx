/**
 * VideoTrimmer Component
 * Allows users to select up to a 10-second segment from a longer video
 * Shows video preview, timeline with thumbnails, and draggable selection handles
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_DURATION = 10; // Max 10 seconds
const MIN_DURATION = 1; // Min 1 second
const TIMELINE_WIDTH = SCREEN_WIDTH - 48; // Padding on each side
const THUMBNAIL_COUNT = 10; // Number of thumbnails to show
const HANDLE_WIDTH = 16; // Width of drag handles

interface VideoTrimmerProps {
  videoUri: string;
  onConfirm: (startTime: number, endTime: number) => void;
  onCancel: () => void;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  videoUri,
  onConfirm,
  onCancel,
}) => {
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectionRef = useRef({ startTime: 0, endTime: 0, isDragging: false, dragType: '' as 'left' | 'right' | 'middle' | '' });
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const playerRef = useRef(player);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);

  // Keep refs updated with current values for pan responders
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  // Initialize endTime when duration is first set
  useEffect(() => {
    if (duration > 0 && endTime === 0) {
      const initialEnd = Math.min(duration, MAX_DURATION);
      setEndTime(initialEnd);
    }
  }, [duration, endTime]);

  // Calculate actual selection duration
  const selectionDuration = useMemo(() => {
    return endTime - startTime;
  }, [startTime, endTime]);

  // Video player
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Track video status
  useEffect(() => {
    if (!player) return;

    console.log('[VideoTrimmer] Setting up player listeners for:', videoUri);

    const subscription = player.addListener('statusChange', (status) => {
      console.log('[VideoTrimmer] Status change:', JSON.stringify(status));
      if (status.status === 'readyToPlay') {
        console.log('[VideoTrimmer] Ready to play, duration from status:', status.duration);
        // Try to get duration from status or from player directly
        const videoDuration = status.duration || player.duration;
        console.log('[VideoTrimmer] Player duration property:', player.duration);
        if (videoDuration && videoDuration > 0) {
          console.log('[VideoTrimmer] Setting duration:', videoDuration);
          setDuration(videoDuration);
        }
      }
    });

    // Fallback: poll for duration if status event doesn't provide it
    const durationPollInterval = setInterval(() => {
      if (player.duration && player.duration > 0 && duration === 0) {
        console.log('[VideoTrimmer] Got duration from polling:', player.duration);
        setDuration(player.duration);
      }
    }, 200);

    return () => {
      subscription.remove();
      clearInterval(durationPollInterval);
    };
  }, [player, videoUri, duration]);

  // Generate thumbnails
  useEffect(() => {
    if (duration <= 0) {
      console.log('[VideoTrimmer] Skipping thumbnail generation, duration:', duration);
      return;
    }

    const generateThumbnails = async () => {
      console.log('[VideoTrimmer] Starting thumbnail generation for duration:', duration);
      setIsLoadingThumbnails(true);
      const newThumbnails: string[] = [];

      try {
        for (let i = 0; i < THUMBNAIL_COUNT; i++) {
          const time = Math.floor((i / THUMBNAIL_COUNT) * duration * 1000); // Convert to milliseconds (must be integer)
          console.log(`[VideoTrimmer] Generating thumbnail ${i + 1}/${THUMBNAIL_COUNT} at ${time}ms`);
          const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time,
            quality: 0.5,
          });
          newThumbnails.push(thumbnail.uri);
        }
        console.log('[VideoTrimmer] All thumbnails generated successfully');
        setThumbnails(newThumbnails);
      } catch (error) {
        console.error('[VideoTrimmer] Failed to generate thumbnails:', error);
        // Still allow trimming even if thumbnails fail
        setThumbnails([]);
      }

      setIsLoadingThumbnails(false);
    };

    generateThumbnails();
  }, [duration, videoUri]);

  // Update playback position during playback
  useEffect(() => {
    if (isPlaying && player) {
      playbackIntervalRef.current = setInterval(() => {
        const time = player.currentTime;
        setCurrentTime(time);

        // Stop at end of selection
        if (time >= endTime) {
          player.pause();
          player.currentTime = startTime;
          setIsPlaying(false);
          setCurrentTime(startTime);
        }
      }, 100);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, player, startTime, endTime]);

  // Pan responder for left handle (adjusts start time)
  const leftHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        selectionRef.current.startTime = startTimeRef.current;
        selectionRef.current.isDragging = true;
        selectionRef.current.dragType = 'left';
      },
      onPanResponderMove: (_, gestureState) => {
        const currentDuration = durationRef.current;
        const currentEndTime = endTimeRef.current;
        if (currentDuration <= 0) return;

        const timePerPixel = currentDuration / TIMELINE_WIDTH;
        const timeDelta = gestureState.dx * timePerPixel;
        let newStartTime = selectionRef.current.startTime + timeDelta;

        // Clamp: can't go below 0, can't get closer than MIN_DURATION to end, can't exceed MAX_DURATION
        const minStart = Math.max(0, currentEndTime - MAX_DURATION);
        const maxStart = currentEndTime - MIN_DURATION;
        newStartTime = Math.max(minStart, Math.min(maxStart, newStartTime));
        setStartTime(newStartTime);

        if (playerRef.current) {
          playerRef.current.currentTime = newStartTime;
          setCurrentTime(newStartTime);
        }
      },
      onPanResponderRelease: () => {
        selectionRef.current.isDragging = false;
        selectionRef.current.dragType = '';
      },
    })
  ).current;

  // Pan responder for right handle (adjusts end time)
  const rightHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        selectionRef.current.endTime = endTimeRef.current;
        selectionRef.current.isDragging = true;
        selectionRef.current.dragType = 'right';
      },
      onPanResponderMove: (_, gestureState) => {
        const currentDuration = durationRef.current;
        const currentStartTime = startTimeRef.current;
        if (currentDuration <= 0) return;

        const timePerPixel = currentDuration / TIMELINE_WIDTH;
        const timeDelta = gestureState.dx * timePerPixel;
        let newEndTime = selectionRef.current.endTime + timeDelta;

        // Clamp: can't exceed duration, must be at least MIN_DURATION from start, can't exceed MAX_DURATION
        const minEnd = currentStartTime + MIN_DURATION;
        const maxEnd = Math.min(currentDuration, currentStartTime + MAX_DURATION);
        newEndTime = Math.max(minEnd, Math.min(maxEnd, newEndTime));
        setEndTime(newEndTime);
      },
      onPanResponderRelease: () => {
        selectionRef.current.isDragging = false;
        selectionRef.current.dragType = '';
      },
    })
  ).current;

  // Pan responder for middle area (moves entire selection)
  const middlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        selectionRef.current.startTime = startTimeRef.current;
        selectionRef.current.endTime = endTimeRef.current;
        selectionRef.current.isDragging = true;
        selectionRef.current.dragType = 'middle';
      },
      onPanResponderMove: (_, gestureState) => {
        const currentDuration = durationRef.current;
        if (currentDuration <= 0) return;

        const timePerPixel = currentDuration / TIMELINE_WIDTH;
        const timeDelta = gestureState.dx * timePerPixel;
        const selectionLength = selectionRef.current.endTime - selectionRef.current.startTime;

        let newStartTime = selectionRef.current.startTime + timeDelta;
        let newEndTime = selectionRef.current.endTime + timeDelta;

        // Clamp to valid range
        if (newStartTime < 0) {
          newStartTime = 0;
          newEndTime = selectionLength;
        }
        if (newEndTime > currentDuration) {
          newEndTime = currentDuration;
          newStartTime = currentDuration - selectionLength;
        }

        setStartTime(newStartTime);
        setEndTime(newEndTime);

        if (playerRef.current) {
          playerRef.current.currentTime = newStartTime;
          setCurrentTime(newStartTime);
        }
      },
      onPanResponderRelease: () => {
        selectionRef.current.isDragging = false;
        selectionRef.current.dragType = '';
      },
    })
  ).current;

  const handlePlayPause = useCallback(() => {
    if (!player) return;

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.currentTime = startTime;
      player.play();
      setIsPlaying(true);
    }
  }, [player, isPlaying, startTime]);

  const handleConfirm = useCallback(() => {
    onConfirm(startTime, endTime);
  }, [startTime, endTime, onConfirm]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate selection position and width
  const selectionLeft = duration > 0 ? (startTime / duration) * TIMELINE_WIDTH : 0;
  const selectionWidth = duration > 0 ? (selectionDuration / duration) * TIMELINE_WIDTH : 0;

  // Calculate playhead position
  const playheadPosition = duration > 0 ? (currentTime / duration) * TIMELINE_WIDTH : 0;

  return (
    <View style={styles.container}>
      {/* Video preview */}
      <View style={styles.videoContainer}>
        {player && (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
          />
        )}

        {/* Play/pause overlay */}
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={handlePlayPause}
          activeOpacity={0.8}
        >
          {!isPlaying && (
            <View style={styles.playButton}>
              <Ionicons name="play" size={40} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineLabel}>Drag handles to select up to 10 seconds</Text>

        <View style={styles.timeline}>
          {/* Thumbnails */}
          <View style={styles.thumbnailsContainer}>
            {duration <= 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            ) : isLoadingThumbnails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Generating preview...</Text>
              </View>
            ) : thumbnails.length > 0 ? (
              thumbnails.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={[styles.thumbnail, { width: TIMELINE_WIDTH / THUMBNAIL_COUNT }]}
                />
              ))
            ) : (
              <View style={styles.noThumbnails}>
                <Text style={styles.loadingText}>Preview unavailable</Text>
              </View>
            )}
          </View>

          {/* Selection overlay */}
          <View
            style={[
              styles.selectionOverlay,
              {
                left: selectionLeft,
                width: selectionWidth,
              },
            ]}
          >
            {/* Left handle - draggable */}
            <View
              style={[styles.handle, styles.handleLeft]}
              {...leftHandlePanResponder.panHandlers}
            >
              <View style={styles.handleBar} />
            </View>

            {/* Middle area - draggable to move whole selection */}
            <View
              style={styles.middleArea}
              {...middlePanResponder.panHandlers}
            />

            {/* Right handle - draggable */}
            <View
              style={[styles.handle, styles.handleRight]}
              {...rightHandlePanResponder.panHandlers}
            >
              <View style={styles.handleBar} />
            </View>
          </View>

          {/* Dimmed areas */}
          <View style={[styles.dimmedArea, { left: 0, width: selectionLeft }]} />
          <View
            style={[
              styles.dimmedArea,
              { left: selectionLeft + selectionWidth, right: 0 },
            ]}
          />

          {/* Playhead */}
          <View
            style={[
              styles.playhead,
              { left: playheadPosition },
            ]}
          />
        </View>

        {/* Time labels */}
        <View style={styles.timeLabels}>
          <Text style={styles.timeText}>{formatTime(startTime)}</Text>
          <Text style={styles.timeDuration}>
            {selectionDuration.toFixed(1)}s selected
          </Text>
          <Text style={styles.timeText}>{formatTime(endTime)}</Text>
        </View>
      </View>

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.controlButton} onPress={onCancel}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6, // Offset for play icon
  },
  timelineContainer: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  timelineLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  timeline: {
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(50,50,50,0.8)',
  },
  thumbnail: {
    height: '100%',
    resizeMode: 'cover',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.sm,
  },
  noThumbnails: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  handle: {
    width: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    marginLeft: -2,
  },
  handleRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    marginRight: -2,
  },
  handleBar: {
    width: 4,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  middleArea: {
    flex: 1,
    height: '100%',
  },
  dimmedArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  playhead: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 3,
    backgroundColor: '#fff',
    borderRadius: 1.5,
    zIndex: 15,
    marginLeft: -1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  timeText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
  },
  timeDuration: {
    color: '#007AFF',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 25,
    gap: spacing[2],
  },
  confirmText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
});

export default VideoTrimmer;
