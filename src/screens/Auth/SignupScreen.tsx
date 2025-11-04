import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUpFn } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';

export default function SignupScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [inviteCode, setInviteCode] = React.useState('');

  const onSignup = async () => {
    if (!email || !pass || !inviteCode) {
      Alert.alert('Missing fields', 'Please fill in all fields');
      return;
    }

    try {
      // Use email as the Cognito username and pass the invite code
      await signUpFn(email, pass, email, inviteCode.trim());
      navigation.navigate('ConfirmCode', { email, password: pass });
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message || String(e));
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
          <View style={{ padding: 24, gap: 12, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: colors.text.primary }}>
              Create account
            </Text>
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              value={pass}
              onChangeText={setPass}
              style={inputStyle}
            />
            <TextInput
              placeholder="Invite Code"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="characters"
              value={inviteCode}
              onChangeText={setInviteCode}
              style={inputStyle}
            />
            <Button title="Sign up" onPress={onSignup} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
