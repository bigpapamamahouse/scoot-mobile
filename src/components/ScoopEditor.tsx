/**
 * ScoopEditor Component
 * Editor for cropping media and adding text overlays
 * - For gallery images: shows crop interface first with pinch-zoom and pan
 * - For camera captures: goes directly to text overlay mode
 * - For videos: goes directly to text overlay mode (or video trimming)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '../theme';
import { ScoopMediaType, ScoopTextOverlay, ScoopFontFamily } from '../types';
import * as ImageManipulator from 'expo-image-manipulator';
import { VideoTrimmer } from './VideoTrimmer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface VideoTrimParams {
  startTime: number;
  endTime: number;
}

interface ScoopEditorProps {
  mediaUri: string;
  mediaType: ScoopMediaType;
  aspectRatio: number;
  videoDuration?: number; // Duration in seconds for videos from gallery
  onPublish: (textOverlays: ScoopTextOverlay[], trimParams?: VideoTrimParams) => void;
  onDiscard: () => void;
  isFromGallery?: boolean; // New prop to determine if cropping is needed
}

interface TextOverlayState extends Omit<ScoopTextOverlay, 'id'> {
  id: string;
  pan: Animated.ValueXY;
  scaleValue: Animated.Value;
  rotationValue: Animated.Value;
}

interface CropState {
  scale: number;
  translateX: number;
  translateY: number;
}

const FONT_OPTIONS: { id: ScoopFontFamily; label: string }[] = [
  { id: 'default', label: 'Sans' },
  { id: 'bold', label: 'Serif' },
  { id: 'script', label: 'Script' },
  { id: 'mono', label: 'Mono' },
];

const COLOR_OPTIONS = [
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
];

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

// Minimum scale based on aspect ratio to ensure image covers screen
const getMinScale = (imageAspectRatio: number): number => {
  const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
  if (imageAspectRatio > screenAspectRatio) {
    // Image is wider - need to scale up to cover height
    return 1;
  } else {
    // Image is taller - need to scale up to cover width
    return screenAspectRatio / imageAspectRatio;
  }
};

export const ScoopEditor: React.FC<ScoopEditorProps> = ({
  mediaUri,
  mediaType,
  aspectRatio,
  videoDuration,
  onPublish,
  onDiscard,
  isFromGallery = false,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [textOverlays, setTextOverlays] = useState<TextOverlayState[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [selectedFont, setSelectedFont] = useState<ScoopFontFamily>('default');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [tapPosition, setTapPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const textInputRef = useRef<TextInput>(null);

  // Ref to store gesture state for each overlay (for direct touch handling)
  const overlayGestureRefs = useRef<Map<string, {
    initialDistance: number;
    initialAngle: number;
    baseScale: number;
    baseRotation: number;
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
    isMultiTouch: boolean;
  }>>(new Map());

  // Track if we're currently touching an overlay (to prevent media tap)
  const isTouchingOverlayRef = useRef(false);

  // Cropping state (for images)
  const [isCropping, setIsCropping] = useState(isFromGallery && mediaType === 'image');
  const [croppedUri, setCroppedUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Video trimming state
  const needsTrimming = isFromGallery && mediaType === 'video' && (videoDuration ?? 0) > 10;
  const [isTrimming, setIsTrimming] = useState(needsTrimming);
  const [trimParams, setTrimParams] = useState<VideoTrimParams | null>(null);
  const [detectedVideoDuration, setDetectedVideoDuration] = useState<number | null>(null);

  // Animation values for cropping
  const cropScale = useRef(new Animated.Value(1)).current;
  const cropTranslateX = useRef(new Animated.Value(0)).current;
  const cropTranslateY = useRef(new Animated.Value(0)).current;

  // Refs for gesture handling
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const baseScale = useRef(1);
  const pinchStartDistance = useRef(0);

  const isVideo = mediaType === 'video';
  const displayUri = croppedUri || mediaUri;

  // Get image dimensions
  useEffect(() => {
    if (mediaType === 'image') {
      Image.getSize(
        mediaUri,
        (width, height) => {
          const size = { width, height };
          setImageSize(size);
          imageSizeRef.current = size; // Update ref for pan responder
          // Calculate initial scale to fit screen while covering it
          const imgAspectRatio = width / height;
          const minScale = getMinScale(imgAspectRatio);
          lastScale.current = minScale;
          cropScale.setValue(minScale);
        },
        (error) => console.error('[ScoopEditor] Failed to get image size:', error)
      );
    }
  }, [mediaUri, mediaType]);

  // Create video player for preview
  const player = useVideoPlayer(isVideo ? displayUri : null, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Handle trimmed video playback - loop only within the trimmed segment
  useEffect(() => {
    if (!player || !trimParams) return;

    // Seek to trim start
    player.currentTime = trimParams.startTime;

    // Set up interval to check if we've passed the end time
    const checkInterval = setInterval(() => {
      if (player.currentTime >= trimParams.endTime) {
        player.currentTime = trimParams.startTime;
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [player, trimParams]);

  // For videos that skip the trimmer, detect duration and set default trimParams for compression
  useEffect(() => {
    if (!isVideo || isTrimming || trimParams) return;

    // If we have videoDuration from props, use it
    if (videoDuration && videoDuration > 0) {
      console.log('[ScoopEditor] Setting default trimParams from prop duration:', videoDuration);
      const endTime = Math.min(videoDuration, 10); // Cap at 10 seconds
      setTrimParams({ startTime: 0, endTime });
      setDetectedVideoDuration(videoDuration);
      return;
    }

    // Otherwise, try to get duration from player
    if (!player) return;

    const checkDuration = () => {
      if (player.duration && player.duration > 0 && !detectedVideoDuration) {
        console.log('[ScoopEditor] Setting default trimParams from player duration:', player.duration);
        const endTime = Math.min(player.duration, 10); // Cap at 10 seconds
        setTrimParams({ startTime: 0, endTime });
        setDetectedVideoDuration(player.duration);
      }
    };

    // Check immediately and poll
    checkDuration();
    const pollInterval = setInterval(checkDuration, 200);

    return () => clearInterval(pollInterval);
  }, [isVideo, isTrimming, trimParams, videoDuration, player, detectedVideoDuration]);

  // Pan responder for cropping gestures
  const cropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Store current values
        baseScale.current = lastScale.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        const currentImageSize = imageSizeRef.current; // Use ref for current value

        if (touches.length === 2) {
          // Pinch to zoom
          const touch1 = touches[0];
          const touch2 = touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );

          if (pinchStartDistance.current === 0) {
            pinchStartDistance.current = distance;
          } else {
            const scaleFactor = distance / pinchStartDistance.current;
            const minScale = currentImageSize ? getMinScale(currentImageSize.width / currentImageSize.height) : 1;
            const newScale = Math.max(minScale, Math.min(3, baseScale.current * scaleFactor));
            cropScale.setValue(newScale);
            lastScale.current = newScale;
          }
        } else if (touches.length === 1) {
          // Pan
          const newTranslateX = lastTranslateX.current + gestureState.dx;
          const newTranslateY = lastTranslateY.current + gestureState.dy;

          // Calculate bounds based on current scale and image size
          if (currentImageSize) {
            const imgAspectRatio = currentImageSize.width / currentImageSize.height;
            const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

            let displayWidth, displayHeight;
            if (imgAspectRatio > screenAspectRatio) {
              // Image is wider
              displayHeight = SCREEN_HEIGHT;
              displayWidth = SCREEN_HEIGHT * imgAspectRatio;
            } else {
              // Image is taller
              displayWidth = SCREEN_WIDTH;
              displayHeight = SCREEN_WIDTH / imgAspectRatio;
            }

            const scaledWidth = displayWidth * lastScale.current;
            const scaledHeight = displayHeight * lastScale.current;

            const maxTranslateX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
            const maxTranslateY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);

            const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
            const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));

            cropTranslateX.setValue(clampedX);
            cropTranslateY.setValue(clampedY);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Save final translate values
        lastTranslateX.current = (cropTranslateX as any)._value || 0;
        lastTranslateY.current = (cropTranslateY as any)._value || 0;
        pinchStartDistance.current = 0;
      },
    })
  ).current;

  const applyCrop = useCallback(async () => {
    if (!imageSize) return;

    try {
      const scale = lastScale.current;
      const translateX = lastTranslateX.current;
      const translateY = lastTranslateY.current;

      // Calculate the crop region in original image coordinates
      const imgAspectRatio = imageSize.width / imageSize.height;
      const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

      let displayWidth, displayHeight;
      if (imgAspectRatio > screenAspectRatio) {
        displayHeight = SCREEN_HEIGHT;
        displayWidth = SCREEN_HEIGHT * imgAspectRatio;
      } else {
        displayWidth = SCREEN_WIDTH;
        displayHeight = SCREEN_WIDTH / imgAspectRatio;
      }

      // Center offset of image before any transform
      const centerOffsetX = (displayWidth - SCREEN_WIDTH) / 2;
      const centerOffsetY = (displayHeight - SCREEN_HEIGHT) / 2;

      // After scaling, find center offset
      const scaledCenterOffsetX = (displayWidth * scale - SCREEN_WIDTH) / 2;
      const scaledCenterOffsetY = (displayHeight * scale - SCREEN_HEIGHT) / 2;

      // Calculate the visible region in display coordinates
      const visibleX = scaledCenterOffsetX - translateX;
      const visibleY = scaledCenterOffsetY - translateY;

      // Convert to original image coordinates
      const scaleToOriginal = imageSize.width / (displayWidth * scale);

      const originX = visibleX * scaleToOriginal;
      const originY = visibleY * scaleToOriginal;
      const cropWidth = (SCREEN_WIDTH * scaleToOriginal);
      const cropHeight = (SCREEN_HEIGHT * scaleToOriginal);

      // Clamp values to valid ranges
      const safeOriginX = Math.max(0, Math.min(imageSize.width - cropWidth, originX));
      const safeOriginY = Math.max(0, Math.min(imageSize.height - cropHeight, originY));
      const safeCropWidth = Math.min(cropWidth, imageSize.width - safeOriginX);
      const safeCropHeight = Math.min(cropHeight, imageSize.height - safeOriginY);

      console.log('[ScoopEditor] Applying crop:', {
        originX: safeOriginX,
        originY: safeOriginY,
        width: safeCropWidth,
        height: safeCropHeight,
        imageSize,
      });

      const result = await ImageManipulator.manipulateAsync(
        mediaUri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeCropWidth,
              height: safeCropHeight,
            },
          },
          {
            resize: {
              width: SCREEN_WIDTH * 2, // 2x for retina
              height: SCREEN_HEIGHT * 2,
            },
          },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log('[ScoopEditor] Crop result:', result);
      setCroppedUri(result.uri);
      setIsCropping(false);
    } catch (error) {
      console.error('[ScoopEditor] Failed to apply crop:', error);
      // Fall back to using original image
      setIsCropping(false);
    }
  }, [imageSize, mediaUri]);

  const resetCrop = useCallback(() => {
    if (imageSize) {
      const minScale = getMinScale(imageSize.width / imageSize.height);
      lastScale.current = minScale;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
      cropScale.setValue(minScale);
      cropTranslateX.setValue(0);
      cropTranslateY.setValue(0);
    }
  }, [imageSize, cropScale, cropTranslateX, cropTranslateY]);

  const addTextOverlay = useCallback(() => {
    if (!currentText.trim()) {
      setIsAddingText(false);
      return;
    }

    // Convert tap position percentage to pixel position
    const pixelX = (tapPosition.x / 100) * SCREEN_WIDTH;
    const pixelY = (tapPosition.y / 100) * SCREEN_HEIGHT;

    const newOverlay: TextOverlayState = {
      id: `overlay-${Date.now()}`,
      text: currentText.trim(),
      x: tapPosition.x,
      y: tapPosition.y,
      fontFamily: selectedFont,
      fontSize: 24,
      color: selectedColor,
      backgroundColor: selectedColor === '#FFFFFF' ? 'rgba(0,0,0,0.5)' : undefined,
      pan: new Animated.ValueXY({ x: pixelX - 50, y: pixelY - 20 }),
      scaleValue: new Animated.Value(1),
      rotationValue: new Animated.Value(0),
    };

    setTextOverlays((prev) => [...prev, newOverlay]);
    setCurrentText('');
    setIsAddingText(false);
    setTapPosition({ x: 50, y: 50 }); // Reset for next time
  }, [currentText, selectedFont, selectedColor, tapPosition]);

  const handleMediaTap = useCallback((event: any) => {
    // Don't open keyboard if we just tapped on an overlay
    if (isTouchingOverlayRef.current) {
      isTouchingOverlayRef.current = false;
      return;
    }

    // Get tap position relative to the media container
    const { locationX, locationY } = event.nativeEvent;
    const xPercent = (locationX / SCREEN_WIDTH) * 100;
    const yPercent = (locationY / SCREEN_HEIGHT) * 100;

    setTapPosition({ x: xPercent, y: yPercent });
    setSelectedOverlayId(null); // Deselect any selected overlay
    setIsAddingText(true);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId(null);
  }, []);

  const handlePublish = useCallback(() => {
    // Convert overlay states to final format with percentage positions
    const finalOverlays: ScoopTextOverlay[] = textOverlays.map((overlay) => {
      // Get final position from animated value
      const x = (overlay.pan.x as any)._value || 0;
      const y = (overlay.pan.y as any)._value || 0;
      const scale = (overlay.scaleValue as any)._value || 1;
      const rotation = (overlay.rotationValue as any)._value || 0;

      return {
        id: overlay.id,
        text: overlay.text,
        x: (x / SCREEN_WIDTH) * 100,
        y: (y / SCREEN_HEIGHT) * 100,
        fontFamily: overlay.fontFamily,
        fontSize: overlay.fontSize,
        color: overlay.color,
        backgroundColor: overlay.backgroundColor,
        scale: scale,
        rotation: rotation,
      };
    });

    onPublish(finalOverlays, trimParams ?? undefined);
  }, [textOverlays, onPublish, trimParams]);

  // Handle video trim confirmation
  const handleTrimConfirm = useCallback((startTime: number, endTime: number) => {
    setTrimParams({ startTime, endTime });
    setIsTrimming(false);
  }, []);

  // Helper function to calculate distance between two touches
  const getDistance = (t1: any, t2: any) => {
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper function to calculate angle between two touches
  const getAngle = (t1: any, t2: any) => {
    const dx = t2.pageX - t1.pageX;
    const dy = t2.pageY - t1.pageY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  // Get or create gesture state for an overlay
  const getGestureState = (overlayId: string) => {
    let state = overlayGestureRefs.current.get(overlayId);
    if (!state) {
      state = {
        initialDistance: 0,
        initialAngle: 0,
        baseScale: 1,
        baseRotation: 0,
        baseX: 0,
        baseY: 0,
        startX: 0,
        startY: 0,
        isMultiTouch: false,
      };
      overlayGestureRefs.current.set(overlayId, state);
    }
    return state;
  };

  // Touch event handlers for overlays
  const handleOverlayTouchStart = useCallback((overlay: TextOverlayState, e: any) => {
    e.stopPropagation();
    isTouchingOverlayRef.current = true; // Prevent media tap from opening keyboard
    const touches = e.nativeEvent.touches;
    const state = getGestureState(overlay.id);

    setSelectedOverlayId(overlay.id);

    // Store base values
    state.baseX = (overlay.pan.x as any)._value || 0;
    state.baseY = (overlay.pan.y as any)._value || 0;
    state.baseScale = (overlay.scaleValue as any)._value || 1;
    state.baseRotation = (overlay.rotationValue as any)._value || 0;

    if (touches.length >= 2) {
      state.isMultiTouch = true;
      state.initialDistance = getDistance(touches[0], touches[1]);
      state.initialAngle = getAngle(touches[0], touches[1]);
    } else {
      state.isMultiTouch = false;
      state.startX = touches[0].pageX;
      state.startY = touches[0].pageY;
    }
  }, []);

  const handleOverlayTouchMove = useCallback((overlay: TextOverlayState, e: any) => {
    const touches = e.nativeEvent.touches;
    const state = getGestureState(overlay.id);

    if (touches.length >= 2) {
      // Two-finger gesture - scale and rotate
      if (!state.isMultiTouch) {
        // Just switched to multi-touch
        state.isMultiTouch = true;
        state.initialDistance = getDistance(touches[0], touches[1]);
        state.initialAngle = getAngle(touches[0], touches[1]);
        state.baseScale = (overlay.scaleValue as any)._value || 1;
        state.baseRotation = (overlay.rotationValue as any)._value || 0;
      }

      const currentDistance = getDistance(touches[0], touches[1]);
      const currentAngle = getAngle(touches[0], touches[1]);

      // Scale
      if (state.initialDistance > 0) {
        const scaleFactor = currentDistance / state.initialDistance;
        const newScale = Math.max(0.5, Math.min(3, state.baseScale * scaleFactor));
        overlay.scaleValue.setValue(newScale);
      }

      // Rotation
      let angleDiff = currentAngle - state.initialAngle;
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;
      overlay.rotationValue.setValue(state.baseRotation + angleDiff);

    } else if (!state.isMultiTouch && touches.length === 1) {
      // Single finger pan
      const dx = touches[0].pageX - state.startX;
      const dy = touches[0].pageY - state.startY;
      overlay.pan.setValue({ x: state.baseX + dx, y: state.baseY + dy });
    }
  }, []);

  const handleOverlayTouchEnd = useCallback((overlay: TextOverlayState, e: any) => {
    const state = getGestureState(overlay.id);
    const remainingTouches = e.nativeEvent.touches;

    if (remainingTouches.length === 0) {
      // All fingers lifted - reset state
      state.isMultiTouch = false;
      state.initialDistance = 0;
      state.initialAngle = 0;
    } else if (remainingTouches.length === 1 && state.isMultiTouch) {
      // Went from 2 fingers to 1 - switch to pan mode
      state.isMultiTouch = false;
      state.startX = remainingTouches[0].pageX;
      state.startY = remainingTouches[0].pageY;
      state.baseX = (overlay.pan.x as any)._value || 0;
      state.baseY = (overlay.pan.y as any)._value || 0;
    }
  }, []);

  // Calculate image display dimensions for cropping view
  const getImageStyle = () => {
    if (!imageSize) return { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };

    const imgAspectRatio = imageSize.width / imageSize.height;
    const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

    if (imgAspectRatio > screenAspectRatio) {
      // Image is wider
      return {
        width: SCREEN_HEIGHT * imgAspectRatio,
        height: SCREEN_HEIGHT,
      };
    } else {
      // Image is taller
      return {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH / imgAspectRatio,
      };
    }
  };

  // Video trimming UI
  if (isTrimming) {
    return (
      <VideoTrimmer
        videoUri={mediaUri}
        onConfirm={handleTrimConfirm}
        onCancel={onDiscard}
      />
    );
  }

  // Cropping UI
  if (isCropping) {
    const imageStyle = getImageStyle();

    return (
      <View style={styles.container}>
        {/* Cropping viewport */}
        <View style={styles.cropContainer} {...cropPanResponder.panHandlers}>
          <Animated.Image
            source={{ uri: mediaUri }}
            style={[
              {
                width: imageStyle.width,
                height: imageStyle.height,
              },
              {
                transform: [
                  { scale: cropScale },
                  { translateX: cropTranslateX },
                  { translateY: cropTranslateY },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Grid overlay for cropping guidance */}
        <View style={styles.cropOverlay} pointerEvents="none">
          <View style={styles.cropGrid}>
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
          </View>
        </View>

        {/* Corner indicators */}
        <View style={styles.cornerIndicators} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={onDiscard}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={resetCrop}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          <Text style={styles.cropHintText}>Pinch to zoom • Drag to position</Text>
          <TouchableOpacity style={styles.publishButton} onPress={applyCrop}>
            <Text style={styles.publishText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main editor UI (text overlays)
  return (
    <View style={styles.container}>
      {/* Media preview - tap anywhere to add text */}
      <TouchableOpacity
        style={styles.mediaContainer}
        activeOpacity={1}
        onPress={handleMediaTap}
      >
        {isVideo && player ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: displayUri }}
            style={styles.media}
            resizeMode="cover"
          />
        )}

        {/* Text overlays */}
        {textOverlays.map((overlay) => {
          // Create rotation interpolation for string output
          const rotateStr = overlay.rotationValue.interpolate({
            inputRange: [-360, 360],
            outputRange: ['-360deg', '360deg'],
          });
          return (
            <Animated.View
              key={overlay.id}
              style={[
                styles.textOverlay,
                {
                  transform: [
                    ...overlay.pan.getTranslateTransform(),
                    { scale: overlay.scaleValue },
                    { rotate: rotateStr },
                  ],
                },
                selectedOverlayId === overlay.id && styles.selectedOverlay,
              ]}
              onTouchStart={(e) => handleOverlayTouchStart(overlay, e)}
              onTouchMove={(e) => handleOverlayTouchMove(overlay, e)}
              onTouchEnd={(e) => handleOverlayTouchEnd(overlay, e)}
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
              {selectedOverlayId === overlay.id && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeOverlay(overlay.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })}
      </TouchableOpacity>

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.controlButton} onPress={onDiscard}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.publishButton}
          onPress={handlePublish}
        >
          <Text style={styles.publishText}>Share Scoop</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Text input overlay */}
      {isAddingText && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.textInputOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableOpacity
            style={styles.textInputBackground}
            activeOpacity={1}
            onPress={() => addTextOverlay()}
          />

          <View style={[styles.textInputContainer, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]}>
            {/* Live text preview */}
            <View style={styles.textPreview}>
              <Text
                style={[
                  styles.previewText,
                  getFontStyle(selectedFont),
                  {
                    color: selectedColor,
                    backgroundColor: selectedColor === '#FFFFFF' ? 'rgba(0,0,0,0.5)' : 'transparent',
                  },
                ]}
              >
                {currentText || 'Preview'}
              </Text>
            </View>

            {/* Font options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fontOptions}
              contentContainerStyle={styles.fontOptionsContent}
            >
              {FONT_OPTIONS.map((font) => (
                <TouchableOpacity
                  key={font.id}
                  style={[
                    styles.fontOption,
                    selectedFont === font.id && styles.fontOptionSelected,
                  ]}
                  onPress={() => setSelectedFont(font.id)}
                >
                  <Text
                    style={[
                      styles.fontOptionText,
                      getFontStyle(font.id),
                      selectedFont === font.id && styles.fontOptionTextSelected,
                    ]}
                  >
                    {font.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorOptions}
              contentContainerStyle={styles.colorOptionsContent}
            >
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </ScrollView>

            {/* Text input */}
            <View style={styles.inputRow}>
              <TextInput
                ref={textInputRef}
                style={[
                  styles.textInput,
                  getFontStyle(selectedFont),
                  { color: selectedColor },
                ]}
                value={currentText}
                onChangeText={setCurrentText}
                placeholder="Type something..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                maxLength={100}
                autoFocus
              />
              <TouchableOpacity
                style={styles.doneButton}
                onPress={addTextOverlay}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  cropContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropGrid: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  gridLineHorizontal: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineVertical: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  cornerIndicators: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 16,
    left: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 16,
    right: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 100,
    left: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 100,
    right: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
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
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
  },
  cropHintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 25,
    gap: spacing[2],
  },
  publishText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  textOverlay: {
    position: 'absolute',
    maxWidth: '80%',
  },
  selectedOverlay: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  overlayText: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    right: -12,
  },
  textInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  textInputBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  textInputContainer: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingBottom: spacing[6],
  },
  textPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    minHeight: 60,
  },
  previewText: {
    fontSize: 24,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  fontOptions: {
    maxHeight: 50,
    marginTop: spacing[3],
  },
  fontOptionsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  fontOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: spacing[2],
  },
  fontOptionSelected: {
    backgroundColor: '#007AFF',
  },
  fontOptionText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
  },
  fontOptionTextSelected: {
    color: '#fff',
  },
  colorOptions: {
    maxHeight: 50,
    marginTop: spacing[3],
  },
  colorOptionsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    alignItems: 'center',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: spacing[2],
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    maxHeight: 100,
  },
  doneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
  },
});

export default ScoopEditor;
