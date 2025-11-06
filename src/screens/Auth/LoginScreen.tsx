import React from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInFn, checkAuthStatus } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, borderRadius } from '../../theme';
import { LiquidGlassBackground, LiquidGlassSurface } from '../../components/layout';
import { Button as AppButton } from '../../components/ui';

export default function LoginScreen({ navigation }: any) {
  const { colors, effectiveMode } = useTheme();
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
      <LiquidGlassBackground style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: 16, color: colors.text.secondary }}>Checking authentication...</Text>
      </LiquidGlassBackground>
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
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    backgroundColor:
      effectiveMode === 'dark'
        ? 'rgba(15, 23, 42, 0.55)'
        : 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor:
      effectiveMode === 'dark'
        ? 'rgba(148, 163, 184, 0.28)'
        : 'rgba(59, 130, 246, 0.22)',
  } as const;

  return (
    <LiquidGlassBackground style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingVertical: spacing[10],
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                paddingHorizontal: spacing[5],
                width: '100%',
                maxWidth: 420,
                alignSelf: 'center',
              }}
            >
              <LiquidGlassSurface
                padding={spacing[2]}
                borderRadius={borderRadius['3xl']}
                contentStyle={{
                  borderRadius: borderRadius['3xl'],
                  padding: spacing[6],
                  gap: spacing[4],
                }}
              >
                <Image
                  source={require('../../../assets/scoot.png')}
                  style={{ width: 180, height: 72, alignSelf: 'center' }}
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
                <View style={{ gap: spacing[2] }}>
                  <AppButton title="Log in" onPress={onLogin} fullWidth />
                  <AppButton
                    title="Need an account? Sign up"
                    onPress={() => navigation.navigate('Signup')}
                    variant="ghost"
                    fullWidth
                  />
                </View>
              </LiquidGlassSurface>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LiquidGlassBackground>
  );
}
