import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
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
import { optimizedMediaUrl, ImagePresets } from '../lib/media';
import { useTheme, borderRadius, typography } from '../theme';

interface ImageGalleryProps {
  images: PostImage[];
  onPress?: (index: number) => void;
  style?: ViewStyle;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ImageGallery({ images, onPress, style }: ImageGalleryProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 48);
  const flatListRef = useRef<FlatList>(null);

  // Debug: Log images array
  console.log('[ImageGallery] Rendering with images:', JSON.stringify(images, null, 2));

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    setCurrentIndex(index);
  }, [containerWidth]);

  const renderImage = useCallback(({ item, index }: { item: PostImage; index: number }) => {
    const imageUri = optimizedMediaUrl(item.key, ImagePresets.feedFull);
    console.log(`[ImageGallery] Image ${index}:`, {
      key: item.key,
      uri: imageUri,
      aspectRatio: item.aspectRatio,
    });

    if (!imageUri) {
      console.log(`[ImageGallery] No URI generated for image ${index}`);
      return null;
    }

    return (
      <Pressable
        onPress={() => onPress?.(index)}
        style={[styles.imageContainer, { width: containerWidth }]}
      >
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            { aspectRatio: item.aspectRatio || 4 / 3 }
          ]}
          resizeMode="cover"
          onError={(e) => console.log(`[ImageGallery] Image ${index} load error:`, e.nativeEvent)}
          onLoad={() => console.log(`[ImageGallery] Image ${index} loaded successfully`)}
        />
      </Pressable>
    );
  }, [onPress, containerWidth]);

  const keyExtractor = useCallback((item: PostImage) => item.key, []);

  // Don't show gallery if no images
  if (!images || images.length === 0) {
    return null;
  }

  // Single image - no pagination needed
  if (images.length === 1) {
    const imageUri = optimizedMediaUrl(images[0].key, ImagePresets.feedFull);
    if (!imageUri) return null;

    return (
      <Pressable onPress={() => onPress?.(0)} style={style}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.singleImage,
            { aspectRatio: images[0].aspectRatio || 4 / 3 }
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
        console.log('[ImageGallery] Container width measured:', width);
        setContainerWidth(width);
      }}
    >
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderImage}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={containerWidth}
        initialNumToRender={images.length}
        maxToRenderPerBatch={images.length}
        windowSize={5}
        removeClippedSubviews={false}
        getItemLayout={(data, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index,
        })}
      />

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
    // Width set dynamically via inline style
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
