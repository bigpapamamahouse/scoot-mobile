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
import { confirmResetPasswordFn } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';

export default function ResetPasswordScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { username } = route.params || {};
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await confirmResetPasswordFn(username, trimmedCode, newPassword);
    setLoading(false);

    switch (result.status) {
      case 'SUCCESS':
        Alert.alert(
          'Password reset successful',
          'Your password has been reset. Please log in with your new password.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
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
              Reset Password
            </Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginBottom: 8 }}>
              Enter the verification code sent to your email and choose a new password.
            </Text>
            <TextInput
              placeholder="Verification code"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              style={inputStyle}
              editable={!loading}
            />
            <TextInput
              placeholder="New password"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={inputStyle}
              editable={!loading}
            />
            <TextInput
              placeholder="Confirm new password"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={inputStyle}
              editable={!loading}
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Button title="Reset password" onPress={onSubmit} />
            )}
            <View style={{ height: 8 }} />
            <Button title="Back to login" onPress={() => navigation.navigate('Login')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
