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
import * as ImagePicker from 'expo-image-picker';
import { PostsAPI } from '../api';
import { ENV } from '../lib/env';
import { readIdToken } from '../lib/storage';

type UploadDescriptor = {
  uploadUrl: string;
  method?: string;
  fields?: Record<string, string>;
  key?: string;
  headers?: Record<string, string>;
};

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
          allowsEditing: true,
          aspect: [4, 3],
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
          allowsEditing: true,
          aspect: [4, 3],
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
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const token = await readIdToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const parseDescriptor = (data: any): UploadDescriptor | null => {
        if (!data || typeof data !== 'object') return null;
        const candidateUrl =
          data.uploadUrl ||
          data.url ||
          data.signedUrl ||
          data.putUrl ||
          data.presignedUrl;
        if (!candidateUrl || typeof candidateUrl !== 'string') return null;
        const fields =
          data.fields && typeof data.fields === 'object'
            ? (data.fields as Record<string, string>)
            : undefined;
        const key =
          data.key ||
          data.imageKey ||
          data.fileKey ||
          data.storageKey ||
          data.objectKey ||
          (fields && fields.key);
        const headers =
          data.headers && typeof data.headers === 'object'
            ? (data.headers as Record<string, string>)
            : data.uploadHeaders && typeof data.uploadHeaders === 'object'
            ? (data.uploadHeaders as Record<string, string>)
            : undefined;
        return {
          uploadUrl: candidateUrl,
          method:
            typeof data.method === 'string'
              ? data.method
              : typeof data.httpMethod === 'string'
              ? data.httpMethod
              : typeof data.verb === 'string'
              ? data.verb
              : undefined,
          fields,
          key,
          headers,
        };
      };

      const descriptorCandidates = [
        '/media/upload-url',
        '/media/presign',
        '/uploads/presign',
        '/upload-url',
        '/media/uploads',
      ];

      const jsonHeaders: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Ignore-Auth-Redirect': '1',
        ...authHeader,
      };

      let descriptor: UploadDescriptor | null = null;
      let lastDescriptorError: string | null = null;

      for (const path of descriptorCandidates) {
        try {
          const response = await fetch(`${ENV.API_URL}${path}`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ contentType: type, fileName: filename, intent: 'post-image' }),
          });

          if (response.status === 404) {
            const text = await response.text().catch(() => '');
            lastDescriptorError = `Upload descriptor endpoint ${path} returned 404${
              text ? `: ${text}` : ''
            }`;
            console.warn(lastDescriptorError);
            continue;
          }

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            lastDescriptorError = `Descriptor request to ${path} failed: ${
              text || `HTTP ${response.status}`
            }`;
            console.warn(lastDescriptorError);
            continue;
          }

          let data: any = null;
          try {
            data = await response.json();
          } catch (parseError) {
            lastDescriptorError = `Descriptor response from ${path} was not valid JSON`;
            console.warn(lastDescriptorError);
            continue;
          }

          const parsed = parseDescriptor(data);
          if (parsed) {
            descriptor = parsed;
            console.log(`Received upload descriptor from ${path}:`, data);
            break;
          }

          if (data && (data.key || data.imageKey || data.fileKey)) {
            const directKey = data.key || data.imageKey || data.fileKey;
            if (typeof directKey === 'string') {
              setImageKey(directKey);
              console.log(`Upload descriptor ${path} returned final key without storage upload.`);
              return;
            }
          }

          lastDescriptorError = `Descriptor response from ${path} did not include an upload URL`;
          console.warn(lastDescriptorError);
        } catch (error: any) {
          lastDescriptorError = `Descriptor request to ${path} threw: ${error?.message || error}`;
          console.warn(lastDescriptorError);
        }
      }

      if (descriptor) {
        let finalKey: string | undefined = descriptor.key;

        if (descriptor.fields) {
          const formData = new FormData();
          Object.entries(descriptor.fields).forEach(([key, value]) => {
            formData.append(key, value);
          });
          formData.append('file', {
            uri,
            name: filename,
            type,
          } as any);

          const uploadResponse = await fetch(descriptor.uploadUrl, {
            method: descriptor.method || 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const text = await uploadResponse.text().catch(() => '');
            throw new Error(
              text ? `Storage upload failed: ${text}` : `Storage upload failed: HTTP ${uploadResponse.status}`
            );
          }

          finalKey = finalKey || descriptor.fields?.key;
        } else {
          const fileResponse = await fetch(uri);
          if (!fileResponse.ok) {
            throw new Error('Failed to read image data for upload');
          }
          const blob = await fileResponse.blob();
          const uploadHeaders: Record<string, string> = {
            ...(descriptor.headers || {}),
          };

          if (!uploadHeaders['Content-Type'] && !uploadHeaders['content-type']) {
            uploadHeaders['Content-Type'] = type;
          }

          const uploadResponse = await fetch(descriptor.uploadUrl, {
            method: descriptor.method || 'PUT',
            headers: uploadHeaders,
            body: blob,
          });

          if (!uploadResponse.ok) {
            const text = await uploadResponse.text().catch(() => '');
            throw new Error(
              text ? `Storage upload failed: ${text}` : `Storage upload failed: HTTP ${uploadResponse.status}`
            );
          }
        }

        if (!finalKey) {
          throw new Error('Upload failed: storage key missing from descriptor response');
        }

        setImageKey(finalKey);
        return;
      }

      // Fall back to direct multipart upload endpoints if no descriptor worked
      const createFormData = () => {
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: filename,
          type,
        } as any);
        return formData;
      };

      const directHeadersBase: Record<string, string> = {
        Accept: 'application/json',
        'X-Ignore-Auth-Redirect': '1',
        ...authHeader,
      };

      const uploadEndpoints = ['/media/upload', '/media', '/upload', '/uploads'];
      let lastNotFoundMessage: string | null = lastDescriptorError;
      let uploadedKey: string | null = null;

      for (const path of uploadEndpoints) {
        const headers = { ...directHeadersBase };
        const response = await fetch(`${ENV.API_URL}${path}`, {
          method: 'POST',
          body: createFormData(),
          headers,
        });

        if (response.status === 404) {
          const notFoundText = await response.text().catch(() => '');
          lastNotFoundMessage = `Upload endpoint ${path} returned 404${
            notFoundText ? `: ${notFoundText}` : ''
          }`;
          console.warn(lastNotFoundMessage);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const message = errorText || `HTTP ${response.status}`;
          throw new Error(message);
        }

        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Upload failed: invalid JSON response');
        }

        const key = data.key || data.imageKey || data.fileKey;
        if (!key) {
          throw new Error('Upload failed: missing image key');
        }

        uploadedKey = key;
        console.log(`Image uploaded via ${path}:`, data);
        break;
      }

      if (!uploadedKey) {
        throw new Error(lastNotFoundMessage || 'Upload failed: endpoint not found');
      }

      setImageKey(uploadedKey);
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
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
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
            <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={showImageOptions}
            disabled={uploading}
          >
            <Text style={styles.addPhotoIcon}>📷</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  imageContainer: {
    margin: 16,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  uploadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 14,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoIcon: {
    fontSize: 24,
  },
  addPhotoText: {
    color: '#2196f3',
    fontSize: 16,
    fontWeight: '500',
  },
  charCount: {
    color: '#999',
    fontSize: 13,
  },
});
