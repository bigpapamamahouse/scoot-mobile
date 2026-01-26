import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInFn } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';
import { useCurrentUser } from '../../contexts/CurrentUserContext';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { refreshUser } = useCurrentUser();
  const { isAuthenticated, needsTermsAcceptance, recheckAuth } = useAuth();
  const [user, setUser] = React.useState('');
  const [pass, setPass] = React.useState('');

  // Navigate based on auth state (auth check already done by AuthContext during splash)
  React.useEffect(() => {
    if (isAuthenticated) {
      if (needsTermsAcceptance) {
        navigation.reset({ index: 0, routes: [{ name: 'TermsOfService' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
      }
    }
  }, [isAuthenticated, needsTermsAcceptance, navigation]);

  const onLogin = async () => {
    const r = await signInFn(user.trim(), pass);
    switch (r.status) {
      case 'SIGNED_IN':
        // Refresh user context and recheck auth - navigation will happen via useEffect
        await refreshUser();
        await recheckAuth();
        return;
      case 'NEEDS_CONFIRMATION':
        Alert.alert('Confirm your account', 'We sent you a code by email.');
        navigation.navigate('ConfirmCode', { username: user.trim() });
        return;
      case 'RESET_PASSWORD':
        Alert.alert('Password reset required', 'You need to reset your password.');
        navigation.navigate('ResetPassword', { username: user.trim() });
        return;
      case 'MFA_REQUIRED':
        Alert.alert('MFA required', `Sign-in requires ${r.type}. (Screen not implemented yet)`);
        return;
      case 'ERROR':
      default:
        Alert.alert(`Login failed: ${r.name}`, r.message);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 24, gap: 12, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Image
              source={require('../../../assets/scoot.png')}
              style={{ width: 200, height: 80, alignSelf: 'center', marginBottom: 16 }}
              resizeMode="contain"
            />
            <TextInput
              placeholder="Username or email"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              value={user}
              onChangeText={setUser}
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
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={{ color: colors.text.link, textAlign: 'right', fontSize: 14 }}>
                Forgot password?
              </Text>
            </TouchableOpacity>
            <Button title="Log in" onPress={onLogin} />
            <View style={{ height: 8 }} />
            <Button title="Need an account? Sign up" onPress={() => navigation.navigate('Signup')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
