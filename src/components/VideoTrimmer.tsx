/**
 * VideoTrimmer Component
 * Allows users to select a 10-second segment from a longer video
 * Shows video preview, timeline with thumbnails, and selection handles
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
const TIMELINE_WIDTH = SCREEN_WIDTH - 48; // Padding on each side
const THUMBNAIL_COUNT = 10; // Number of thumbnails to show

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
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectionRef = useRef({ startTime: 0, isDragging: false });
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate end time based on start time
  const endTime = useMemo(() => {
    return Math.min(startTime + MAX_DURATION, duration);
  }, [startTime, duration]);

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

    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && status.duration) {
        setDuration(status.duration);
      }
    });

    return () => subscription.remove();
  }, [player]);

  // Generate thumbnails
  useEffect(() => {
    if (duration <= 0) return;

    const generateThumbnails = async () => {
      setIsLoadingThumbnails(true);
      const newThumbnails: string[] = [];

      try {
        for (let i = 0; i < THUMBNAIL_COUNT; i++) {
          const time = (i / THUMBNAIL_COUNT) * duration * 1000; // Convert to milliseconds
          const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time,
            quality: 0.5,
          });
          newThumbnails.push(thumbnail.uri);
        }
        setThumbnails(newThumbnails);
      } catch (error) {
        console.error('[VideoTrimmer] Failed to generate thumbnails:', error);
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

  // Pan responder for dragging the selection window
  const selectionPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        selectionRef.current.startTime = startTime;
        selectionRef.current.isDragging = true;
      },
      onPanResponderMove: (_, gestureState) => {
        if (duration <= 0) return;

        // Calculate time change from drag
        const timePerPixel = duration / TIMELINE_WIDTH;
        const timeDelta = gestureState.dx * timePerPixel;
        let newStartTime = selectionRef.current.startTime + timeDelta;

        // Clamp to valid range
        newStartTime = Math.max(0, Math.min(duration - MAX_DURATION, newStartTime));
        setStartTime(newStartTime);

        // Update video position
        if (player) {
          player.currentTime = newStartTime;
          setCurrentTime(newStartTime);
        }
      },
      onPanResponderRelease: () => {
        selectionRef.current.isDragging = false;
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
        <Text style={styles.timelineLabel}>Drag to select 10 seconds</Text>

        <View style={styles.timeline}>
          {/* Thumbnails */}
          <View style={styles.thumbnailsContainer}>
            {isLoadingThumbnails ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              thumbnails.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={[styles.thumbnail, { width: TIMELINE_WIDTH / THUMBNAIL_COUNT }]}
                />
              ))
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
            {...selectionPanResponder.panHandlers}
          >
            {/* Left handle */}
            <View style={[styles.handle, styles.handleLeft]}>
              <View style={styles.handleBar} />
            </View>

            {/* Right handle */}
            <View style={[styles.handle, styles.handleRight]}>
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
  },
  thumbnail: {
    height: '100%',
    resizeMode: 'cover',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleLeft: {
    left: -2,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  handleRight: {
    right: -2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  handleBar: {
    width: 4,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 2,
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
