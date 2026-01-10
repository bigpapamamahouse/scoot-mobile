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
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '../theme';
import { ScoopMediaType } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 10000; // 10 seconds

interface ScoopCameraProps {
  onCapture: (uri: string, type: ScoopMediaType, aspectRatio: number) => void;
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingProgress = useRef(new Animated.Value(0)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

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
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
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
        onCapture(photo.uri, 'image', aspectRatio);
      }
    } catch (error: any) {
      console.error('[ScoopCamera] Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, [onCapture]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    setIsRecording(true);
    setRecordingDuration(0);

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
        onCapture(video.uri, 'video', aspectRatio);
      }
    } catch (error: any) {
      console.error('[ScoopCamera] Failed to record video:', error);
      setIsRecording(false);
    }
  }, [isRecording, recordingProgress, onCapture]);

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

  const handlePressIn = useCallback(() => {
    isLongPress.current = false;

    // Start timer to detect long press
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      startRecording();
    }, 200);
  }, [startRecording]);

  const handlePressOut = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    if (isRecording) {
      // Was recording, stop it
      stopRecording();
    } else if (!isLongPress.current) {
      // Was a short tap, take photo
      takePhoto();
    }
  }, [isRecording, stopRecording, takePhoto]);

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
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode={isRecording ? 'video' : 'picture'}
      />

      {/* Recording progress bar */}
      {isRecording && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
          <Text style={styles.durationText}>
            {formatDuration(recordingDuration)} / 10s
          </Text>
        </View>
      )}

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.controlButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
          <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <Text style={styles.hintText}>
          {isRecording ? 'Recording...' : 'Tap for photo, hold for video'}
        </Text>

        {/* Shutter button */}
        <TouchableOpacity
          style={[
            styles.shutterButton,
            isRecording && styles.shutterButtonRecording,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.shutterInner,
              isRecording && styles.shutterInnerRecording,
            ]}
          />
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
  durationText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    fontWeight: '600',
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
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
