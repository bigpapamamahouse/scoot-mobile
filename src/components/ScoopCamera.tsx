/**
 * ScoopCamera Component
 * Camera for capturing photos and short videos (up to 10 seconds)
 * Tap shutter to take photo, hold to record video
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  Alert,
  PanResponder,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '../theme';
import { ScoopMediaType } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 10000; // 10 seconds
const MAX_ZOOM = 0.5; // Maximum zoom level (0-1 range for expo-camera)
const ZOOM_SENSITIVITY = 0.6; // How much of screen height to reach max zoom (higher = less sensitive)

interface ScoopCameraProps {
  onCapture: (uri: string, type: ScoopMediaType, aspectRatio: number, isFromGallery: boolean, videoDuration?: number) => void;
  onClose: () => void;
}

export const ScoopCamera: React.FC<ScoopCameraProps> = ({
  onCapture,
  onClose,
}) => {
  const { colors } = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraKey, setCameraKey] = useState(0); // Force camera remount when switching
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [zoom, setZoom] = useState(0);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const isRecordingRef = useRef(false);
  const shutterStartY = useRef(0);
  const isCameraReadyRef = useRef(false);

  // Refs for functions that pan responder needs to call
  const startRecordingRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => void>(() => {});
  const takePhotoRef = useRef<() => void>(() => {});

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isCameraReadyRef.current = isCameraReady;
  }, [isCameraReady]);

  // Shutter button pan responder - handles press, hold for video, and zoom gesture
  const shutterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        shutterStartY.current = gestureState.y0;
        isLongPress.current = false;

        // Start timer to detect long press for video recording
        pressTimer.current = setTimeout(() => {
          isLongPress.current = true;
          // Start recording via ref
          if (cameraRef.current && !isRecordingRef.current && isCameraReadyRef.current) {
            startRecordingRef.current();
          }
        }, 200);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only zoom while recording
        if (isRecordingRef.current) {
          // Moving up (negative dy) increases zoom
          // ZOOM_SENSITIVITY controls how much screen movement = full zoom
          const zoomDelta = -(gestureState.y0 - shutterStartY.current + gestureState.dy) / (SCREEN_HEIGHT * ZOOM_SENSITIVITY);
          const newZoom = Math.max(0, Math.min(MAX_ZOOM, zoomDelta));
          setZoom(newZoom);
        }
      },
      onPanResponderRelease: () => {
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }

        if (isRecordingRef.current) {
          // Was recording, stop it
          stopRecordingRef.current();
        } else if (!isLongPress.current) {
          // Was a short tap, take photo
          takePhotoRef.current();
        }

        // Reset zoom when releasing
        setZoom(0);
      },
      onPanResponderTerminate: () => {
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }
        if (isRecordingRef.current) {
          stopRecordingRef.current();
        }
        setZoom(0);
      },
    })
  ).current;

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!micPermission?.granted) {
        await requestMicPermission();
      }
    })();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (durationTimer.current) clearInterval(durationTimer.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const toggleFacing = useCallback(() => {
    setIsCameraReady(false);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
    // Increment key to force camera remount - fixes front camera recording issues
    setCameraKey((prev) => prev + 1);
  }, []);

  const handleCameraReady = useCallback(() => {
    console.log('[ScoopCamera] Camera is ready');
    setIsCameraReady(true);
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        const aspectRatio = (photo.width || SCREEN_WIDTH) / (photo.height || SCREEN_HEIGHT);
        onCapture(photo.uri, 'image', aspectRatio, false);
      }
    } catch (error: any) {
      console.error('[ScoopCamera] Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, [onCapture]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording || !isCameraReady) {
      if (!isCameraReady) {
        console.warn('[ScoopCamera] Camera not ready yet, cannot record');
      }
      return;
    }

    setIsRecording(true);
    setRecordingDuration(0);
    setZoom(0); // Reset zoom when starting recording

    // Start progress animation
    recordingProgress.setValue(0);
    Animated.timing(recordingProgress, {
      toValue: 1,
      duration: MAX_VIDEO_DURATION,
      useNativeDriver: false,
    }).start();

    // Start duration counter
    durationTimer.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 100);
    }, 100);

    // Auto-stop after max duration
    recordingTimer.current = setTimeout(() => {
      stopRecording();
    }, MAX_VIDEO_DURATION);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_DURATION / 1000,
      });

      if (video?.uri) {
        const aspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT; // Assuming full-screen capture
        onCapture(video.uri, 'video', aspectRatio, false);
      }
    } catch (error: any) {
      console.error('[ScoopCamera] Failed to record video:', error);
      setIsRecording(false);
    }
  }, [isRecording, isCameraReady, recordingProgress, onCapture]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;

    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    recordingProgress.stopAnimation();
    setIsRecording(false);

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.warn('[ScoopCamera] Error stopping recording:', error);
    }
  }, [isRecording, recordingProgress]);

  // Update function refs so pan responder can call them
  useEffect(() => {
    takePhotoRef.current = takePhoto;
  }, [takePhoto]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const pickFromGallery = useCallback(async () => {
    try {
      // Request media library permissions first (required for iOS 14+)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select photos and videos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false, // We'll handle cropping in the editor
        quality: 1.0, // Keep full quality, we'll compress later
        videoMaxDuration: 10,
        // On iOS, copy the media locally to handle iCloud files that aren't downloaded
        ...(Platform.OS === 'ios' && { copyLocalMedia: true }),
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        const aspectRatio = (asset.width || SCREEN_WIDTH) / (asset.height || SCREEN_HEIGHT);
        // Duration is in milliseconds, convert to seconds
        const durationInSeconds = isVideo && asset.duration ? asset.duration / 1000 : undefined;
        onCapture(asset.uri, isVideo ? 'video' : 'image', aspectRatio, true, durationInSeconds);
      }
    } catch (error) {
      console.error('[ScoopCamera] Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick from gallery. Please try again.');
    }
  }, [onCapture]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  if (!cameraPermission?.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Ionicons name="camera-outline" size={64} color={colors.text.secondary} />
        <Text style={[styles.permissionText, { color: colors.text.primary }]}>
          Camera permission is required
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary[500] }]}
          onPress={requestCameraPermission}
        >
          <Text style={[styles.permissionButtonText, { color: colors.text.inverse }]}>
            Grant Permission
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButtonPermission} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  const progressWidth = recordingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <CameraView
        key={cameraKey}
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        zoom={zoom}
        onCameraReady={handleCameraReady}
      />

      {/* Recording progress bar */}
      {isRecording && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
          <View style={styles.recordingInfo}>
            <Text style={styles.durationText}>
              {formatDuration(recordingDuration)} / 10s
            </Text>
            {zoom > 0 && (
              <Text style={styles.zoomText}>
                {(1 + zoom * 4).toFixed(1)}x
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Top controls - close button only */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls - redesigned layout */}
      <View style={styles.bottomControls}>
        <Text style={styles.hintText}>
          {!isCameraReady ? 'Loading camera...' : isRecording ? 'Slide up to zoom' : 'Tap for photo, hold for video'}
        </Text>

        <View style={styles.controlsRow}>
          {/* Gallery button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={pickFromGallery}
            disabled={isRecording}
          >
            <Ionicons name="images-outline" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Shutter button with pan responder for zoom */}
          <View
            style={[
              styles.shutterButton,
              isRecording && styles.shutterButtonRecording,
            ]}
            {...shutterPanResponder.panHandlers}
          >
            <View
              style={[
                styles.shutterInner,
                isRecording && styles.shutterInnerRecording,
              ]}
            />
          </View>

          {/* Flip camera button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleFacing}
            disabled={isRecording}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  permissionText: {
    fontSize: typography.fontSize.lg,
    marginTop: spacing[4],
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  closeButtonPermission: {
    position: 'absolute',
    top: 60,
    right: spacing[4],
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 2,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
    gap: spacing[3],
  },
  durationText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  zoomText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  topControls: {
    position: 'absolute',
    top: 16,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonRecording: {
    borderColor: '#FF3B30',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  shutterInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
});

export default ScoopCamera;
