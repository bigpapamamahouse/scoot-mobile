import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PostsAPI, CreatePostImage } from '../api';
import { uploadMedia } from '../lib/upload';
import { Button } from '../components/ui';
import { MentionTextInput } from '../components/MentionTextInput';
import { MultiImagePicker, UploadingImage } from '../components/MultiImagePicker';
import { useTheme, spacing, typography, borderRadius } from '../theme';
import { imageDimensionCache } from '../lib/imageCache';
import { mediaUrlFromKey, deleteMedia } from '../lib/media';

const MAX_IMAGES = 10;

export default function ComposePostScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [text, setText] = React.useState('');
  const [images, setImages] = React.useState<UploadingImage[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Use ref instead of state to avoid race condition on unmount
  const postedRef = React.useRef(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Cleanup: Delete uploaded images if user navigates away without posting
  React.useEffect(() => {
    return () => {
      // Only delete if there are uploaded images and the post wasn't created
      if (!postedRef.current) {
        images.forEach(img => {
          if (img.key) {
            deleteMedia(img.key)
              .then(() => console.log('Cleaned up unused uploaded image:', img.key))
              .catch((error) => console.warn('Failed to cleanup unused image:', error));
          }
        });
      }
    };
  }, [images]);

  const compressImage = async (uri: string, width: number, height: number) => {
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1920;

    let resize: { width?: number; height?: number } | undefined;

    // Only resize if image exceeds max dimensions
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const aspectRatio = width / height;

      if (width > height) {
        // Landscape or square
        resize = { width: MAX_WIDTH };
      } else {
        // Portrait
        resize = { height: MAX_HEIGHT };
      }
    }

    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      resize ? [{ resize }] : [],
      {
        compress: 0.8, // Good balance between quality and file size
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipResult;
  };

  const uploadImage = async (uri: string, width: number, height: number, index: number) => {
    try {
      // Update image as uploading
      setImages(prev => prev.map((img, i) =>
        i === index ? { ...img, uploading: true, error: undefined } : img
      ));

      const key = await uploadMedia({ uri, intent: 'post-image' });

      // Cache dimensions for the S3 URL so it's available when viewing the post
      if (key && width && height) {
        const s3Url = mediaUrlFromKey(key);
        if (s3Url) {
          imageDimensionCache.set(s3Url, {
            width,
            height,
            aspectRatio: width / height,
          });
        }
      }

      // Update image with S3 key
      setImages(prev => prev.map((img, i) =>
        i === index ? { ...img, key, uploading: false } : img
      ));
    } catch (error: any) {
      console.error('Error uploading image:', error);
      // Mark image with error
      setImages(prev => prev.map((img, i) =>
        i === index ? { ...img, uploading: false, error: error?.message || 'Upload failed' } : img
      ));
      Alert.alert('Upload Error', `Failed to upload image ${index + 1}`);
    }
  };

  const pickImages = async (fromCamera: boolean) => {
    try {
      if (images.length >= MAX_IMAGES) {
        Alert.alert('Limit Reached', `You can only add up to ${MAX_IMAGES} photos per post`);
        return;
      }

      let result;

      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.8,
        });
      } else {
        const { status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: MAX_IMAGES - images.length,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        const newImages: UploadingImage[] = [];

        for (const asset of result.assets) {
          const uri = asset.uri;
          let { width, height } = asset;

          // Compress and resize image before uploading
          let processedUri = uri;
          try {
            const compressed = await compressImage(uri, width, height);
            processedUri = compressed.uri;
            width = compressed.width;
            height = compressed.height;
          } catch (error) {
            console.warn('Image compression failed, using original:', error);
            // Continue with original image if compression fails
          }

          // Cache dimensions immediately for the local URI (for preview)
          const aspectRatio = width && height ? width / height : 4 / 3;
          imageDimensionCache.set(processedUri, {
            width,
            height,
            aspectRatio,
          });

          newImages.push({
            uri: processedUri,
            aspectRatio,
            width,
            height,
            uploading: false,
          });
        }

        // Add new images to the list
        const startIndex = images.length;
        setImages(prev => [...prev, ...newImages]);

        // Upload all new images in parallel
        newImages.forEach((img, idx) => {
          uploadImage(img.uri, img.width || 0, img.height || 0, startIndex + idx);
        });
      }
    } catch (error: any) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = async (index: number) => {
    const img = images[index];

    // Delete from S3 if it was uploaded
    if (img.key) {
      try {
        await deleteMedia(img.key);
        console.log('Deleted uploaded image:', img.key);
      } catch (error) {
        console.warn('Failed to delete image from S3:', error);
        // Continue with local removal even if S3 deletion fails
      }
    }

    // Remove from list
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!text.trim() && images.length === 0) {
      Alert.alert('Error', 'Please enter some text or attach at least one image');
      return;
    }

    // Check if any images are still uploading
    const stillUploading = images.some(img => img.uploading);
    if (stillUploading) {
      Alert.alert('Upload in Progress', 'Please wait for all images to finish uploading');
      return;
    }

    // Check if any images failed to upload
    const hasErrors = images.some(img => img.error);
    if (hasErrors) {
      Alert.alert('Upload Failed', 'Some images failed to upload. Please remove them or try again.');
      return;
    }

    setLoading(true);
    try {
      // Convert to CreatePostImage format
      const postImages: CreatePostImage[] = images
        .filter(img => img.key) // Only include successfully uploaded images
        .map(img => ({
          key: img.key!,
          aspectRatio: img.aspectRatio,
          width: img.width,
          height: img.height,
        }));

      await PostsAPI.createPost(
        text.trim(),
        postImages.length > 0 ? postImages : undefined
      );

      postedRef.current = true; // Mark as posted so cleanup doesn't delete the images
      Alert.alert('Success', 'Post created!');
      navigation.goBack();
    } catch (e: any) {
      console.error('Failed to create post:', e);
      Alert.alert('Error', e?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photos',
      'Choose a source',
      [
        { text: 'Camera', onPress: () => pickImages(true) },
        { text: 'Gallery', onPress: () => pickImages(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const isUploading = images.some(img => img.uploading);
  const hasImages = images.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="ghost"
            size="sm"
          />
          <Text style={styles.title}>New Post</Text>
          <Button
            title="Post"
            onPress={handlePost}
            disabled={loading || isUploading || (!text.trim() && !hasImages)}
            loading={loading}
            variant="primary"
            size="sm"
          />
        </View>

        <ScrollView style={styles.content}>
          <MentionTextInput
            style={styles.textInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.text.tertiary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            autoFocus
            placement="below"
            autocompleteMaxHeight={250}
            flex={false}
          />

          {hasImages && (
            <MultiImagePicker
              images={images}
              maxImages={MAX_IMAGES}
              onImagesChange={setImages}
              onAddPress={showImageOptions}
              onRemoveImage={removeImage}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {!hasImages ? (
            <Button
              title="Add Photos"
              onPress={showImageOptions}
              variant="ghost"
              size="md"
            />
          ) : (
            <Text style={styles.imageCount}>
              {images.length}/{MAX_IMAGES} photo{images.length !== 1 ? 's' : ''}
            </Text>
          )}
          <Text style={styles.charCount}>
            {text.length}/500
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.elevated,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.styles.h5,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  textInput: {
    padding: spacing[4],
    fontSize: typography.fontSize.base,
    textAlignVertical: 'top',
    minHeight: 44,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  imageCount: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  charCount: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});
