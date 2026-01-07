import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  onAddPress,
  onRemoveImage,
  style,
}: MultiImagePickerProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const canAddMore = images.length < maxImages;

  const renderImage = (item: UploadingImage, index: number) => {
    return (
      <View key={index} style={styles.imageItem}>
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

        {/* Order Number */}
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{index + 1}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((item, index) => renderImage(item, index))}

        {/* Add Photo Button */}
        {canAddMore && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddPress}
            disabled={!canAddMore}
          >
            <Ionicons name="add-circle-outline" size={40} color={colors.primary[500]} />
            <Text style={styles.addText}>Add Photo</Text>
            <Text style={styles.countText}>
              {images.length}/{maxImages}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Max Limit Reached */}
      {!canAddMore && (
        <View style={styles.maxLimitContainer}>
          <Text style={styles.maxLimitText}>
            Max {maxImages} photos reached
          </Text>
        </View>
      )}

      {/* Reorder Hint */}
      {images.length > 1 && (
        <Text style={styles.hintText}>
          Images will appear in the order shown
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: spacing[3],
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    alignItems: 'center',
  },
  imageItem: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    position: 'relative',
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
    padding: spacing[2],
    alignItems: 'center',
  },
  maxLimitText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  hintText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
  },
});
