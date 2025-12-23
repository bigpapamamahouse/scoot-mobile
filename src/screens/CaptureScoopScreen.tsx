import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme';

const MAX_VIDEO_DURATION = 10000; // 10 seconds in milliseconds
const { width, height } = Dimensions.get('window');

export default function CaptureScoopScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [facing, setFacing] = React.useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const cameraRef = React.useRef<CameraView>(null);
  const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = React.useRef<number>(0);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={64} color={colors.textSecondary} />
          <Text style={styles.permissionText}>
            Camera permission is required to create scoops
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const toggleCameraFacing = () => {
    setIsCameraReady(false); // Reset ready state when switching cameras
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleShutterPressIn = async () => {
    if (isRecording || isProcessing || !isCameraReady) return;

    // Start recording video
    setIsRecording(true);
    setRecordingTime(0);
    recordingStartTimeRef.current = Date.now();

    // Update timer every 100ms
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartTimeRef.current;
      setRecordingTime(elapsed);

      // Auto-stop at max duration
      if (elapsed >= MAX_VIDEO_DURATION) {
        handleShutterPressOut();
      }
    }, 100);

    try {
      if (cameraRef.current) {
        const video = await cameraRef.current.recordAsync({
          maxDuration: MAX_VIDEO_DURATION / 1000, // Convert to seconds
        });

        if (video && video.uri) {
          // Process and navigate to editor
          await processMedia(video.uri, 'video');
        }
      }
    } catch (error) {
      console.error('Error recording video:', error);
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      Alert.alert('Error', 'Failed to record video');
    }
  };

  const handleShutterPressOut = async () => {
    if (!isRecording) return;

    // Stop recording
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    try {
      if (cameraRef.current) {
        await cameraRef.current.stopRecording();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }

    setIsRecording(false);
    setRecordingTime(0);
  };

  const handleShutterPress = async () => {
    if (isRecording || isProcessing || !isCameraReady) return;

    // Take photo
    setIsProcessing(true);
    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });

        if (photo && photo.uri) {
          await processMedia(photo.uri, 'photo');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const processMedia = async (uri: string, type: 'photo' | 'video') => {
    try {
      let processedUri = uri;
      let aspectRatio = 1;

      if (type === 'photo') {
        // Compress and resize photo
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1080 } }],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        processedUri = manipResult.uri;
        aspectRatio = manipResult.width / manipResult.height;
      } else {
        // For video, we'll keep the original and get aspect ratio from dimensions
        // Note: Getting video dimensions would require expo-av, for now assume 9:16
        aspectRatio = 9 / 16;
      }

      const duration = type === 'video' ? recordingTime / 1000 : undefined;

      // Navigate to editor
      navigation.replace('EditScoop', {
        mediaUri: processedUri,
        mediaType: type,
        aspectRatio,
        duration,
      });
    } catch (error) {
      console.error('Error processing media:', error);
      Alert.alert('Error', 'Failed to process media');
    }
  };

  const progressPercentage = (recordingTime / MAX_VIDEO_DURATION) * 100;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onCameraReady={() => {
          // Add small delay to ensure camera is fully ready
          setTimeout(() => setIsCameraReady(true), 300);
        }}
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topButton}
          onPress={toggleCameraFacing}
        >
          <Ionicons name="camera-reverse" size={32} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Recording indicator and timer */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>
            {(recordingTime / 1000).toFixed(1)}s
          </Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {isRecording && (
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
        )}

        <View style={styles.controls}>
          <View style={styles.spacer} />

          {/* Shutter button */}
          <TouchableOpacity
            style={styles.shutterButtonContainer}
            onPressIn={handleShutterPressIn}
            onPressOut={handleShutterPressOut}
            onPress={handleShutterPress}
            delayPressIn={200} // 200ms delay to distinguish tap from hold
            disabled={isProcessing || !isCameraReady}
          >
            <View style={[
              styles.shutterButton,
              isRecording && styles.shutterButtonRecording,
            ]}>
              {isProcessing && (
                <ActivityIndicator size="large" color="white" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              {isRecording ? 'Release to stop' : 'Tap for photo\nHold for video'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'black',
    },
    camera: {
      flex: 1,
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    permissionText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    permissionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    topButton: {
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 24,
    },
    recordingIndicator: {
      position: 'absolute',
      top: 80,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    recordingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#ff3b30',
    },
    recordingTime: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 40,
    },
    progressBarContainer: {
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: '#ff3b30',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    spacer: {
      flex: 1,
    },
    shutterButtonContainer: {
      alignItems: 'center',
    },
    shutterButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'white',
      borderWidth: 6,
      borderColor: 'rgba(255, 255, 255, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    shutterButtonRecording: {
      backgroundColor: '#ff3b30',
      borderRadius: 12,
      width: 64,
      height: 64,
    },
    instructionContainer: {
      flex: 1,
      alignItems: 'flex-end',
    },
    instructionText: {
      color: 'white',
      fontSize: 12,
      textAlign: 'right',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });
