import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { signOutFn } from '../api/auth';
import { UsersAPI, InvitesAPI } from '../api';
import { Avatar } from '../components/Avatar';
import { uploadMedia } from '../lib/upload';
import { mediaUrlFromKey } from '../lib/media';
import { readStoredInviteCode, writeStoredInviteCode } from '../lib/storage';

type ViewerProfile = {
  fullName?: string | null;
  avatarKey?: string | null;
  inviteCode?: string | null;
};

type LoadViewerOptions = {
  silent?: boolean;
};

export default function SettingsScreen({ navigation }: any) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [avatarKey, setAvatarKey] = React.useState<string | null>(null);
  const [inviteCode, setInviteCode] = React.useState<string | null>(null);
  const [initialFullName, setInitialFullName] = React.useState('');
  const [initialAvatarKey, setInitialAvatarKey] = React.useState<string | null>(null);
  const [avatarPreviewUri, setAvatarPreviewUri] = React.useState<string | null>(null);

  const ensureInviteCode = React.useCallback(
    async (viewerId?: string | null): Promise<string | null> => {
      const normalizedId = typeof viewerId === 'string' ? viewerId.trim() : '';
      if (normalizedId) {
        const cached = await readStoredInviteCode(normalizedId);
        if (cached) {
          return cached;
        }
      }

      try {
        if (InvitesAPI.listInvites) {
          const existing = await InvitesAPI.listInvites();
          const existingCode = UsersAPI.findInviteCode?.(existing) ?? null;
          if (existingCode) {
            if (normalizedId) {
              await writeStoredInviteCode(normalizedId, existingCode);
            }
            return existingCode;
          }
        }
      } catch (error) {
        console.warn('Failed to load existing invites:', error);
      }

      try {
        const payload = await InvitesAPI.createInvite(10);
        const code = UsersAPI.findInviteCode?.(payload) ?? null;
        const fallback =
          payload && typeof payload === 'object' && 'code' in (payload as any)
            ? String((payload as any).code)
            : null;
        const normalizedCode = code || (fallback && fallback.trim().length > 0 ? fallback.trim() : null);
        if (normalizedCode && normalizedId) {
          await writeStoredInviteCode(normalizedId, normalizedCode);
        }
        return normalizedCode ?? null;
      } catch (error: any) {
        console.error('Failed to generate invite code:', error);
        return null;
      }
    },
    []
  );

  const loadViewer = React.useCallback(async (options?: LoadViewerOptions) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const data: ViewerProfile | null = await UsersAPI.me();
      const normalizedFullName =
        data && typeof data.fullName === 'string' ? data.fullName : '';
      const normalizedAvatarKey = data?.avatarKey ?? null;
      const normalizedHandle =
        data && typeof (data as any).handle === 'string' ? (data as any).handle : '';
      const normalizedEmail =
        data && typeof (data as any).email === 'string' ? (data as any).email : '';
      const normalizedId =
        data && typeof (data as any).id === 'string' && (data as any).id.trim().length
          ? (data as any).id.trim()
          : null;
      let normalizedInviteCode =
        data && typeof data.inviteCode === 'string' && data.inviteCode.trim().length
          ? data.inviteCode.trim()
          : null;

      if (!normalizedInviteCode && normalizedId) {
        normalizedInviteCode = await readStoredInviteCode(normalizedId);
      }

      if (!normalizedInviteCode) {
        normalizedInviteCode = await ensureInviteCode(normalizedId);
      }

      console.log('[SettingsScreen loadViewer] Setting state - avatarKey:', normalizedAvatarKey);
      setFullName(normalizedFullName);
      setInitialFullName(normalizedFullName);
      setHandle(normalizedHandle);
      setEmail(normalizedEmail);
      setAvatarKey(normalizedAvatarKey);
      setInitialAvatarKey(normalizedAvatarKey);
      setInviteCode(normalizedInviteCode);
      setAvatarPreviewUri(null);
      console.log('[SettingsScreen loadViewer] Avatar preview URI cleared');

      if (normalizedInviteCode && normalizedId) {
        await writeStoredInviteCode(normalizedId, normalizedInviteCode);
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', error?.message || 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, [ensureInviteCode]);

  React.useEffect(() => {
    loadViewer();
  }, [loadViewer]);

  const handleLogout = async () => {
    try {
      await signOutFn();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to sign out.');
    }
  };

  const uploadAvatar = React.useCallback(
    async (uri: string) => {
      setUploading(true);
      try {
        console.log('[SettingsScreen] Starting avatar upload...');
        const key = await uploadMedia({ uri, intent: 'avatar-image' });
        console.log('[SettingsScreen] Upload complete, key:', key);
        setAvatarKey(key);
        const remotePreview = mediaUrlFromKey(key);
        console.log('[SettingsScreen] Remote preview URL:', remotePreview);
        setAvatarPreviewUri(remotePreview ?? uri);
      } catch (error: any) {
        console.error('[SettingsScreen] Failed to upload avatar:', error);
        Alert.alert('Error', error?.message || 'Failed to upload profile photo.');
        setAvatarPreviewUri(null);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const pickImage = React.useCallback(
    async (fromCamera: boolean) => {
      try {
        let result;
        if (fromCamera) {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required.');
            return;
          }
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Photo library permission is required.');
            return;
          }
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });
        }

        if (!result.canceled && result.assets?.[0]?.uri) {
          const uri = result.assets[0].uri;
          setAvatarPreviewUri(uri);
          await uploadAvatar(uri);
        }
      } catch (error: any) {
        console.error('Error selecting image:', error);
        Alert.alert('Error', 'Failed to select image.');
      }
    },
    [uploadAvatar]
  );

  const showImageOptions = () => {
    Alert.alert('Update profile photo', 'Choose an option', [
      { text: 'Camera', onPress: () => pickImage(true) },
      { text: 'Photo library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = () => {
    if (!avatarKey && !avatarPreviewUri) {
      return;
    }
    Alert.alert('Remove photo', 'Are you sure you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setAvatarKey(null);
          setAvatarPreviewUri(null);
        },
      },
    ]);
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const normalizedName = trimmedName.length ? trimmedName : '';

    const hasNameChange = normalizedName !== initialFullName.trim();
    const hasAvatarChange = (avatarKey ?? null) !== (initialAvatarKey ?? null);

    if (!hasNameChange && !hasAvatarChange) {
      Alert.alert('No changes', 'Update your profile before saving.');
      return;
    }

    setSaving(true);
    try {
      // Always use PATCH /me and include all fields to prevent data loss
      // The POST /me/avatar endpoint has a backend bug that wipes other fields
      const payload: any = {};

      // Always include fullName to preserve it
      payload.fullName = trimmedName.length ? trimmedName : null;

      // Always include avatar (even if unchanged) to preserve it
      if (hasAvatarChange || avatarKey) {
        payload.avatarKey = avatarKey;
      }

      // Preserve handle and email
      if (handle) payload.handle = handle;
      if (email) payload.email = email;

      console.log('[SettingsScreen] Saving all user data via PATCH /me:', payload);
      await UsersAPI.updateMe(payload);

      await loadViewer({ silent: true });

      // Navigate back to profile after successful save
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', error?.message || 'Failed to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  const inviteCodeLabel = inviteCode || 'Unavailable';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Profile photo</Text>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              {avatarPreviewUri ? (
                <Image source={{ uri: avatarPreviewUri }} style={styles.avatarImage} />
              ) : (
                <Avatar avatarKey={avatarKey} size={88} />
              )}
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.avatarActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, uploading && styles.disabledButton]}
                onPress={showImageOptions}
                disabled={uploading}
              >
                <Text style={styles.secondaryButtonText}>
                  {uploading ? 'Uploading…' : 'Change photo'}
                </Text>
              </TouchableOpacity>
              {(avatarKey || avatarPreviewUri) && (
                <TouchableOpacity
                  onPress={removePhoto}
                  disabled={uploading}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkButtonText, uploading && styles.linkButtonDisabled]}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
            editable={!saving && !uploading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invite code</Text>
          <View style={styles.inviteCodeBox}>
            <Text selectable style={styles.inviteCodeText}>
              {inviteCodeLabel}
            </Text>
          </View>
          <Text style={styles.inviteHint}>Share this code with friends to invite them.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (saving || uploading) && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={saving || uploading}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActions: {
    flex: 1,
    alignItems: 'flex-start',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2196f3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#2196f3',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  linkButton: {
    paddingVertical: 4,
    marginTop: 4,
  },
  linkButtonText: {
    color: '#e53935',
    fontWeight: '600',
  },
  linkButtonDisabled: {
    color: '#e57373',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  inviteCodeBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#90caf9',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#e3f2fd',
  },
  inviteCodeText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  inviteHint: {
    marginTop: 8,
    color: '#607d8b',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 32,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
