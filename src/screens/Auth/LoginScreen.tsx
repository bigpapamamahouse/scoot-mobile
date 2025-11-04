import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInFn, checkAuthStatus } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';

export default function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [user, setUser] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [checking, setChecking] = React.useState(true);

  // Check if user is already authenticated when component mounts
  React.useEffect(() => {
    checkAuthStatus().then(isAuthenticated => {
      if (isAuthenticated) {
        console.log('User already authenticated, navigating to Feed');
        navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
      } else {
        setChecking(false);
      }
    }).catch(() => {
      setChecking(false);
    });
  }, [navigation]);

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 16, color: colors.text.secondary }}>Checking authentication...</Text>
      </SafeAreaView>
    );
  }

  const onLogin = async () => {
    const r = await signInFn(user.trim(), pass);
    switch (r.status) {
      case 'SIGNED_IN':
        navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
        return;
      case 'NEEDS_CONFIRMATION':
        Alert.alert('Confirm your account', 'We sent you a code by email.');
        navigation.navigate('ConfirmCode', { username: user.trim() });
        return;
      case 'RESET_PASSWORD':
        Alert.alert('Password reset required', 'Please reset your password on the website for now.');
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
          <View style={{ padding: 24, gap: 12, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: colors.text.primary }}>
              Welcome to ScooterBooter
            </Text>
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
            <Button title="Log in" onPress={onLogin} />
            <View style={{ height: 8 }} />
            <Button title="Need an account? Sign up" onPress={() => navigation.navigate('Signup')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
