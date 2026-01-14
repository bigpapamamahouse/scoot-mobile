import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
  Text,
  LayoutAnimation,
  Platform,
  UIManager,
  LayoutChangeEvent,
} from 'react-native';
import { PostImage } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { useTheme, borderRadius, typography } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ImageGalleryProps {
  images: PostImage[];
  onPress?: (index: number) => void;
  style?: ViewStyle;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_HEIGHT = 600; // Prevent extremely tall images from dominating feed

export function ImageGallery({ images, onPress, style }: ImageGalleryProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate heights for each image based on aspect ratio and container width
  const imageHeights = useMemo(() => {
    if (containerWidth === 0) return images.map(() => 0);
    return images.map((image) => {
      const aspectRatio = image.aspectRatio || 4 / 3;
      const calculatedHeight = containerWidth / aspectRatio;
      return Math.min(calculatedHeight, MAX_IMAGE_HEIGHT);
    });
  }, [images, containerWidth]);

  // Get the current container height based on current image
  const currentHeight = imageHeights[currentIndex] || 0;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth === 0) return; // Wait until width is measured
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      // Animate the height change
      LayoutAnimation.configureNext({
        duration: 200,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
      setCurrentIndex(index);
    }
  }, [containerWidth, currentIndex, images.length]);

  // Don't show gallery if no images
  if (!images || images.length === 0) {
    return null;
  }

  // Single image - no pagination needed
  if (images.length === 1) {
    const imageUri = mediaUrlFromKey(images[0].key);
    if (!imageUri) return null;

    const aspectRatio = images[0].aspectRatio || 4 / 3;

    return (
      <Pressable onPress={() => onPress?.(0)} style={style}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.singleImage,
            {
              aspectRatio,
              maxHeight: MAX_IMAGE_HEIGHT,
            }
          ]}
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  // Multiple images - show carousel with pagination
  // Use current image height for dynamic sizing, or max height if not yet measured
  const displayHeight = containerWidth > 0 && currentHeight > 0 ? currentHeight : undefined;

  return (
    <View
      style={[
        styles.container,
        style,
        displayHeight ? { height: displayHeight } : undefined,
      ]}
      onLayout={(e: LayoutChangeEvent) => {
        const width = e.nativeEvent.layout.width;
        if (width !== containerWidth) {
          setContainerWidth(width);
        }
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={containerWidth > 0 ? containerWidth : undefined}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {images.map((image, index) => {
          const imageUri = mediaUrlFromKey(image.key);
          if (!imageUri) return null;

          const imageHeight = imageHeights[index] || 0;

          return (
            <Pressable
              key={image.key}
              onPress={() => onPress?.(index)}
              style={[
                styles.imageContainer,
                containerWidth > 0 && {
                  width: containerWidth,
                  height: currentHeight,
                },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  {
                    width: containerWidth,
                    height: imageHeight,
                  }
                ]}
                resizeMode="cover"
              />
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Page Indicator Badge */}
      <View style={styles.pageIndicatorContainer}>
        <View style={styles.pageIndicatorBadge}>
          <Text style={styles.pageIndicatorText}>
            {currentIndex + 1}/{images.length}
          </Text>
        </View>
      </View>

      {/* Dot Indicators */}
      <View style={styles.dotContainer}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex
                  ? colors.primary[500]
                  : 'rgba(255, 255, 255, 0.5)',
                width: index === currentIndex ? 8 : 6,
                height: index === currentIndex ? 8 : 6,
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%', // Fallback, will be overridden by inline style
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: borderRadius.base,
  },
  singleImage: {
    width: '100%',
    borderRadius: borderRadius.base,
  },
  pageIndicatorContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  pageIndicatorBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  pageIndicatorText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  dotContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 4,
  },
});
