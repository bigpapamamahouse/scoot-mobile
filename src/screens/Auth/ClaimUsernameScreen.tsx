import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import { signInFn } from '../../api/auth';
import { updateMe, updateAvatar } from '../../api/users';
import { uploadMedia } from '../../lib/upload';

export default function ClaimUsernameScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const email = route?.params?.email || '';
  const password = route?.params?.password || '';
  const [username, setUsername] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const onComplete = async () => {
    if (!username.trim()) {
      Alert.alert('Missing username', 'Please enter a username');
      return;
    }

    // Validate username: only letters and numbers allowed
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username.trim())) {
      Alert.alert(
        'Invalid username',
        'Username can only contain letters and numbers. No spaces or special characters allowed.'
      );
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Missing authentication details. Please log in manually.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }

    setIsLoading(true);
    try {
      // First, sign in the user
      const signInResult = await signInFn(email, password);

      if (signInResult.status !== 'SIGNED_IN') {
        throw new Error('Failed to sign in after confirmation');
      }

      // Update profile with handle and full name
      try {
        console.log('[ClaimUsername] Updating profile with:', {
          handle: username.trim(),
          fullName: fullName.trim(),
        });
        await updateMe({
          handle: username.trim(),
          fullName: fullName.trim(),
        });
        console.log('[ClaimUsername] Profile updated successfully');
      } catch (updateError) {
        console.error('[ClaimUsername] Failed to update profile:', updateError);
        Alert.alert('Warning', 'Failed to update profile information');
        // Continue anyway since they're signed in
      }

      // Upload and set avatar if provided
      if (avatarUri) {
        try {
          console.log('[ClaimUsername] Uploading avatar...');
          const avatarKey = await uploadMedia({
            uri: avatarUri,
            intent: 'avatar-image',
          });
          console.log('[ClaimUsername] Avatar uploaded:', avatarKey);

          await updateAvatar(avatarKey);
          console.log('[ClaimUsername] Avatar set successfully');
        } catch (uploadError) {
          console.error('[ClaimUsername] Failed to upload/set avatar:', uploadError);
          Alert.alert('Warning', 'Failed to upload profile picture');
          // Continue without avatar if upload fails
        }
      }

      // Navigate to the main app
      navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
      setIsLoading(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: 8,
    padding: 12,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }} edges={[]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 16, color: colors.text.secondary }}>Setting up your account...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={[]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
          <View style={{ padding: 24, gap: 16, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: colors.text.primary }}>
              Complete your profile
            </Text>
            <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 16, color: colors.text.secondary }}>
              Set up your profile to get started
            </Text>

            {/* Profile Picture */}
            <TouchableOpacity
              onPress={pickImage}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: colors.neutral[200],
                alignSelf: 'center',
                marginBottom: 16,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: colors.border.main,
              }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center' }}>
                  Tap to add{'\n'}profile photo
                </Text>
              )}
            </TouchableOpacity>

            {/* Username */}
            <View>
              <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 4, paddingLeft: 4 }}>
                Username
              </Text>
              <TextInput
                placeholder="username"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                style={inputStyle}
              />
            </View>

            {/* Full Name */}
            <View>
              <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 4, paddingLeft: 4 }}>
                Full Name
              </Text>
              <TextInput
                placeholder="John Doe"
                placeholderTextColor={colors.text.tertiary}
                value={fullName}
                onChangeText={setFullName}
                style={inputStyle}
              />
            </View>

            <TouchableOpacity
              onPress={onComplete}
              style={{
                backgroundColor: colors.primary[500],
                padding: 14,
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Complete Setup
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
