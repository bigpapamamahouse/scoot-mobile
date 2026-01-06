import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme, spacing, typography, borderRadius } from '../theme';
import { IconButton } from './ui';

export interface UploadingImage {
  uri: string;           // Local URI
  key?: string;          // S3 key (after upload)
  aspectRatio: number;
  width?: number;
  height?: number;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

interface MultiImagePickerProps {
  images: UploadingImage[];
  maxImages?: number;
  onImagesChange: (images: UploadingImage[]) => void;
  onAddPress: () => void;
  onRemoveImage: (index: number) => void;
  style?: ViewStyle;
}

export function MultiImagePicker({
  images,
  maxImages = 10,
  onImagesChange,
  onAddPress,
  onRemoveImage,
  style,
}: MultiImagePickerProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const canAddMore = images.length < maxImages;

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<UploadingImage>) => {
    const index = getIndex();
    if (index === undefined) return null;

    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive || item.uploading}
          activeOpacity={0.8}
          style={[
            styles.imageItem,
            isActive && styles.imageItemActive,
          ]}
        >
          <Image source={{ uri: item.uri }} style={styles.thumbnail} />

          {/* Upload Progress Overlay */}
          {item.uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="white" />
              {item.progress !== undefined && (
                <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
              )}
            </View>
          )}

          {/* Error Overlay */}
          {item.error && (
            <View style={styles.errorOverlay}>
              <Ionicons name="alert-circle" size={24} color="white" />
              <Text style={styles.errorText}>Failed</Text>
            </View>
          )}

          {/* Remove Button */}
          {!item.uploading && (
            <IconButton
              icon="close"
              onPress={() => onRemoveImage(index)}
              variant="solid"
              size="sm"
              style={styles.removeButton}
              backgroundColor="rgba(0,0,0,0.6)"
              color="white"
            />
          )}

          {/* Drag Indicator */}
          {!item.uploading && (
            <View style={styles.dragIndicator}>
              <Ionicons name="reorder-three" size={20} color="white" />
            </View>
          )}

          {/* Order Number */}
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>{index + 1}</Text>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <DraggableFlatList
          data={images}
          onDragEnd={({ data }) => onImagesChange(data)}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </GestureHandlerRootView>

      {/* Add Photo Button */}
      {canAddMore && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddPress}
          disabled={!canAddMore}
        >
          <Ionicons name="add-circle-outline" size={40} color={colors.primary[500]} />
          <Text style={styles.addText}>
            Add Photo
          </Text>
          <Text style={styles.countText}>
            {images.length}/{maxImages}
          </Text>
        </TouchableOpacity>
      )}

      {/* Max Limit Reached */}
      {!canAddMore && (
        <View style={styles.maxLimitContainer}>
          <Text style={styles.maxLimitText}>
            Max {maxImages} photos
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: spacing[3],
  },
  gestureRoot: {
    minHeight: 120,
  },
  listContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  imageItem: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    position: 'relative',
    marginRight: spacing[2],
  },
  imageItemActive: {
    opacity: 0.8,
    transform: [{ scale: 1.05 }],
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  progressText: {
    color: 'white',
    fontSize: typography.fontSize.xs,
    marginTop: spacing[1],
    fontWeight: typography.fontWeight.semibold,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  errorText: {
    color: 'white',
    fontSize: typography.fontSize.xs,
    marginTop: spacing[1],
    fontWeight: typography.fontWeight.semibold,
  },
  removeButton: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
  },
  dragIndicator: {
    position: 'absolute',
    bottom: spacing[1],
    left: spacing[1],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  orderBadge: {
    position: 'absolute',
    bottom: spacing[1],
    right: spacing[1],
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: 'white',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[4],
  },
  addText: {
    color: colors.primary[500],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing[1],
  },
  countText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: spacing[1],
  },
  maxLimitContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  maxLimitText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});
