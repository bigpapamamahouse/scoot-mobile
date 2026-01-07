import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { PostImage } from '../types';
import { mediaUrlFromKey, optimizedMediaUrl, ImagePresets } from '../lib/media';
import { useTheme, borderRadius, typography } from '../theme';

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

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth === 0) return; // Wait until width is measured
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    setCurrentIndex(index);
  }, [containerWidth]);

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
  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        setContainerWidth(width);
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
      >
        {images.map((image, index) => {
          const imageUri = mediaUrlFromKey(image.key);
          if (!imageUri) return null;

          const aspectRatio = image.aspectRatio || 4 / 3;

          return (
            <Pressable
              key={image.key}
              onPress={() => onPress?.(index)}
              style={[
                styles.imageContainer,
                containerWidth > 0 && { width: containerWidth }
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  {
                    aspectRatio,
                    maxHeight: MAX_IMAGE_HEIGHT,
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
  },
  imageContainer: {
    width: '100%', // Fallback, will be overridden by inline style
  },
  image: {
    width: '100%',
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
