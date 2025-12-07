import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PostsAPI } from '../api';
import { uploadMedia } from '../lib/upload';
import { Button, IconButton } from '../components/ui';
import { MentionTextInput } from '../components/MentionTextInput';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';
import { imageDimensionCache } from '../lib/imageCache';
import { mediaUrlFromKey, deleteMedia } from '../lib/media';

export default function ComposePostScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [text, setText] = React.useState('');
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [imageKey, setImageKey] = React.useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  // Use ref instead of state to avoid race condition on unmount
  const postedRef = React.useRef(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Cleanup: Delete uploaded image if user navigates away without posting
  React.useEffect(() => {
    return () => {
      // Only delete if there's an uploaded image and the post wasn't created
      if (imageKey && !postedRef.current) {
        deleteMedia(imageKey)
          .then(() => console.log('Cleaned up unused uploaded image:', imageKey))
          .catch((error) => console.warn('Failed to cleanup unused image:', error));
      }
    };
  }, [imageKey]);

  const pickImage = async (fromCamera: boolean) => {
    try {
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
        });
      }

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        let { width, height } = result.assets[0];

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
        const aspectRatio = width && height ? width / height : null;
        if (aspectRatio) {
          imageDimensionCache.set(processedUri, {
            width,
            height,
            aspectRatio,
          });
          setImageAspectRatio(aspectRatio);
        }

        setImageUri(processedUri);
        await uploadImage(processedUri, width, height);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

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

  const uploadImage = async (uri: string, width?: number, height?: number) => {
    setUploading(true);
    try {
      // If there's already an uploaded image, delete it first
      if (imageKey) {
        try {
          await deleteMedia(imageKey);
          console.log('Deleted previous uploaded image:', imageKey);
        } catch (error) {
          console.warn('Failed to delete previous image:', error);
          // Continue with new upload even if deletion fails
        }
      }

      const key = await uploadMedia({ uri, intent: 'post-image' });
      setImageKey(key);

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
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error?.message ? `Failed to upload image: ${error.message}` : 'Failed to upload image');
      setImageUri(null);
      setImageKey(null);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    // Delete from S3 if it was uploaded
    if (imageKey) {
      try {
        await deleteMedia(imageKey);
        console.log('Deleted unused uploaded image:', imageKey);
      } catch (error) {
        console.warn('Failed to delete image from S3:', error);
        // Continue with local removal even if S3 deletion fails
      }
    }

    setImageUri(null);
    setImageKey(null);
    setImageAspectRatio(null);
  };

  const handlePost = async () => {
    if (!text.trim() && !imageKey) {
      Alert.alert('Error', 'Please enter some text or attach an image');
      return;
    }

    setLoading(true);
    try {
      await PostsAPI.createPost(
        text.trim(),
        imageKey || undefined,
        imageAspectRatio || undefined
      );
      postedRef.current = true; // Mark as posted so cleanup doesn't delete the image
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
      'Add Photo',
      'Choose a source',
      [
        { text: 'Camera', onPress: () => pickImage(true) },
        { text: 'Gallery', onPress: () => pickImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
            disabled={loading || uploading || (!text.trim() && !imageKey)}
            loading={loading}
            variant="primary"
            size="sm"
          />
        </View>

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

        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
            <IconButton
              icon="close"
              onPress={removeImage}
              variant="solid"
              size="sm"
              style={styles.removeImageButton}
              backgroundColor="rgba(0,0,0,0.6)"
              color={colors.text.inverse}
            />
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={showImageOptions}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary[500]} />
            <Text style={styles.addPhotoText}>Add Photo</Text>
          </TouchableOpacity>
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
  textInput: {
    padding: spacing[4],
    fontSize: typography.fontSize.base,
    textAlignVertical: 'top',
    minHeight: 44,
    color: colors.text.primary,
  },
  imageContainer: {
    margin: spacing[4],
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  uploadingText: {
    color: colors.text.inverse,
    marginTop: spacing[2],
    fontSize: typography.fontSize.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  addPhotoText: {
    color: colors.primary[500],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  charCount: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});
