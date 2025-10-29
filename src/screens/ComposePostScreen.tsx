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
import * as ImagePicker from 'expo-image-picker';
import { PostsAPI } from '../api';
import { uploadMedia } from '../lib/upload';
import { ModernScreen } from '../components/ui/ModernScreen';
import { GlassCard } from '../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors';

export default function ComposePostScreen({ navigation }: any) {
  const [text, setText] = React.useState('');
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [imageKey, setImageKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

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
    <ModernScreen edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <GlassCard style={styles.sheet} contentStyle={styles.sheetContent}>
          <View style={styles.inner}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>New Post</Text>
              <TouchableOpacity
                onPress={handlePost}
                disabled={loading || uploading || (!text.trim() && !imageKey)}
                style={[
                  styles.postButton,
                  (loading || uploading || (!text.trim() && !imageKey)) && styles.postButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[palette.accent, palette.accentSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {loading ? (
                  <ActivityIndicator color={palette.textPrimary} />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <TextInput
                style={styles.textInput}
                placeholder="Share something with everyone..."
                placeholderTextColor={palette.textMuted}
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
                      <ActivityIndicator size="large" color={palette.textPrimary} />
                      <Text style={styles.uploadingText}>Uploading...</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={showImageOptions}
                disabled={uploading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(148,163,184,0.4)', 'rgba(129,140,248,0.4)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.addPhotoContent}>
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.charCount}>{text.length}/500</Text>
            </View>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  sheet: {
    width: '100%',
    flexGrow: 1,
  },
  sheetContent: {
    padding: 24,
  },
  inner: {
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelButton: {
    fontSize: 16,
    color: palette.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  postButton: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  body: {
    gap: 16,
  },
  textInput: {
    padding: 18,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 140,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.55)',
    color: palette.textPrimary,
    lineHeight: 22,
  },
  imageContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 220,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: palette.textPrimary,
    marginTop: 8,
    fontSize: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.75)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPhotoButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addPhotoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addPhotoIcon: {
    fontSize: 20,
  },
  addPhotoText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  charCount: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
