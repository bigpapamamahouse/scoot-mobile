import React from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resetPasswordFn } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [username, setUsername] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Alert.alert('Error', 'Please enter your username or email');
      return;
    }

    setLoading(true);
    const result = await resetPasswordFn(trimmedUsername);
    setLoading(false);

    switch (result.status) {
      case 'CODE_SENT':
        Alert.alert(
          'Code sent',
          `A verification code has been sent to ${result.destination}`
        );
        navigation.navigate('ResetPassword', { username: trimmedUsername });
        return;
      case 'DONE':
        Alert.alert('Success', 'Password reset complete');
        navigation.goBack();
        return;
      case 'ERROR':
        Alert.alert('Error', result.message);
        return;
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ padding: 24, gap: 16, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '600', color: colors.text.primary, textAlign: 'center' }}>
              Forgot Password
            </Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginBottom: 8 }}>
              Enter your username or email and we'll send you a code to reset your password.
            </Text>
            <TextInput
              placeholder="Username or email"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={username}
              onChangeText={setUsername}
              style={inputStyle}
              editable={!loading}
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Button title="Send reset code" onPress={onSubmit} />
            )}
            <View style={{ height: 8 }} />
            <Button title="Back to login" onPress={() => navigation.goBack()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
