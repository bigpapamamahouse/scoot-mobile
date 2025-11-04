import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { signInFn } from '../../api/auth';
import { updateMe } from '../../api/users';

export default function ClaimUsernameScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const email = route?.params?.email || '';
  const password = route?.params?.password || '';
  const [username, setUsername] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const onClaimUsername = async () => {
    if (!username.trim()) {
      Alert.alert('Missing username', 'Please enter a username');
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

      // Now update their profile with the username
      // Note: The backend might need a separate 'handle' field, for now using fullName
      try {
        await updateMe({ fullName: username.trim() });
      } catch (updateError) {
        console.warn('Failed to update username:', updateError);
        // Continue anyway since they're signed in
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 16, color: colors.text.secondary }}>Setting up your account...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12, color: colors.text.primary }}>
              Choose your username
            </Text>
            <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 12, color: colors.text.secondary }}>
              This is how others will see you on the app
            </Text>
            <TextInput
              placeholder="Username"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              style={inputStyle}
            />
            <Button title="Claim Username" onPress={onClaimUsername} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
