import React from 'react';
import {
  View,
  Text,
  TextInput,
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
import { PostsAPI } from '../api';
import { uploadMedia } from '../lib/upload';
import { Button, IconButton } from '../components/ui';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';

export default function ComposePostScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [text, setText] = React.useState('');
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [imageKey, setImageKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
        setImageUri(uri);
        await uploadImage(uri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const key = await uploadMedia({ uri, intent: 'post-image' });
      setImageKey(key);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error?.message ? `Failed to upload image: ${error.message}` : 'Failed to upload image');
      setImageUri(null);
      setImageKey(null);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageKey(null);
  };

  const handlePost = async () => {
    if (!text.trim() && !imageKey) {
      Alert.alert('Error', 'Please enter some text or attach an image');
      return;
    }

    setLoading(true);
    try {
      await PostsAPI.createPost(text.trim(), imageKey || undefined);
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

        <TextInput
          style={styles.textInput}
          placeholder="What's on your mind?"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
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
    minHeight: 120,
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
