import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PostsAPI, CreatePostImage } from '../api';
import { uploadMedia } from '../lib/upload';
import { Button } from '../components/ui';
import { MentionTextInput } from '../components/MentionTextInput';
import { MultiImagePicker, UploadingImage } from '../components/MultiImagePicker';
import { SpotifyCard } from '../components/SpotifyCard';
import { useTheme, spacing, typography, borderRadius } from '../theme';
import { imageDimensionCache } from '../lib/imageCache';
import { mediaUrlFromKey, deleteMedia } from '../lib/media';
import { hasSpotifyUrl, fetchSpotifyEmbedFromText, detectSpotifyUrls, SpotifyEmbed } from '../lib/spotify';

const MAX_IMAGES = 10;

export default function ComposePostScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  // Get initial text from route params (e.g., from share intent)
  const initialText = route?.params?.initialText || '';
  const [text, setText] = React.useState(initialText);
  const [images, setImages] = React.useState<UploadingImage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [spotifyEmbed, setSpotifyEmbed] = React.useState<SpotifyEmbed | null>(null);
  const [loadingSpotify, setLoadingSpotify] = React.useState(false);

  // Use ref instead of state to avoid race condition on unmount
  const postedRef = React.useRef(false);

  // Track the last fetched URL to avoid duplicate fetches
  const lastFetchedUrlRef = React.useRef<string | null>(null);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Use ref to track images for cleanup without triggering effect re-runs
  const imagesRef = React.useRef<UploadingImage[]>([]);
  React.useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup: Delete uploaded images if user navigates away without posting
  React.useEffect(() => {
    return () => {
      // Only delete if there are uploaded images and the post wasn't created
      if (!postedRef.current) {
        imagesRef.current.forEach(img => {
          if (img.key) {
            deleteMedia(img.key)
              .then(() => console.log('Cleaned up unused uploaded image:', img.key))
              .catch((error) => console.warn('Failed to cleanup unused image:', error));
          }
        });
      }
    };
  }, []); // Empty deps - only run cleanup on unmount

  // Detect Spotify URLs and fetch metadata
  React.useEffect(() => {
    // Skip if we already have an embed (URL was already processed)
    if (spotifyEmbed) {
      return;
    }

    // Check if text contains a Spotify URL
    if (!hasSpotifyUrl(text)) {
      return;
    }

    // Debounce the fetch to avoid too many API calls while typing
    const timeoutId = setTimeout(async () => {
      setLoadingSpotify(true);
      try {
        const embed = await fetchSpotifyEmbedFromText(text);
        if (embed) {
          setSpotifyEmbed(embed);
          lastFetchedUrlRef.current = embed.spotifyUrl;

          // Strip the Spotify URL from the text input
          const detectedUrls = detectSpotifyUrls(text);
          let cleanedText = text;
          for (const url of detectedUrls) {
            cleanedText = cleanedText.replace(url, '');
          }
          // Clean up extra whitespace
          cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
          setText(cleanedText);
        }
      } catch (error) {
        console.warn('Failed to fetch Spotify embed:', error);
      } finally {
        setLoadingSpotify(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [text, spotifyEmbed]);


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
        .map((img, index) => ({
          key: img.key!,
          aspectRatio: img.aspectRatio,
          width: img.width,
          height: img.height,
          order: index,
        }));

      await PostsAPI.createPost(
        text.trim(),
        postImages.length > 0 ? postImages : undefined,
        spotifyEmbed || undefined
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

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
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

          {/* Spotify Preview */}
          {(spotifyEmbed || loadingSpotify) && (
            <View style={styles.spotifyPreviewContainer}>
              {loadingSpotify ? (
                <View style={styles.spotifyLoading}>
                  <Text style={styles.spotifyLoadingText}>Loading Spotify preview...</Text>
                </View>
              ) : spotifyEmbed ? (
                <View>
                  <View style={styles.spotifyHeader}>
                    <Text style={styles.spotifyHeaderText}>Spotify Link Detected</Text>
                    <TouchableOpacity onPress={() => setSpotifyEmbed(null)}>
                      <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                  <SpotifyCard embed={spotifyEmbed} compact />
                </View>
              ) : null}
            </View>
          )}

          {/* Image picker - always visible */}
          {hasImages ? (
            <MultiImagePicker
              images={images}
              maxImages={MAX_IMAGES}
              onImagesChange={setImages}
              onAddPress={showImageOptions}
              onRemoveImage={removeImage}
            />
          ) : (
            <TouchableOpacity
              style={styles.addPhotosButton}
              onPress={showImageOptions}
            >
              <Ionicons name="camera-outline" size={24} color={colors.primary[500]} />
              <Text style={styles.addPhotosText}>Add Photos</Text>
            </TouchableOpacity>
          )}

          {/* Character count at bottom of scrollable area */}
          <Text style={styles.charCountInline}>
            {text.length}/500 characters
            {hasImages && ` • ${images.length}/${MAX_IMAGES} photo${images.length !== 1 ? 's' : ''}`}
          </Text>
        </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing[6],
  },
  textInput: {
    padding: spacing[4],
    fontSize: typography.fontSize.base,
    textAlignVertical: 'top',
    minHeight: 100,
    color: colors.text.primary,
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderStyle: 'dashed',
    backgroundColor: colors.background.base,
  },
  addPhotosText: {
    color: colors.primary[500],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  charCountInline: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  spotifyPreviewContainer: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  spotifyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  spotifyHeaderText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  spotifyLoading: {
    padding: spacing[4],
    alignItems: 'center',
  },
  spotifyLoadingText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});
