import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInFn } from '../../api/auth';
import { directCognitoAuth } from '../../api/directCognitoAuth';

export default function LoginScreen({ navigation }: any) {
  const [user, setUser] = React.useState('');
  const [pass, setPass] = React.useState('');

  const onDirectLogin = async () => {
    console.log('=== Using Direct Cognito Auth (Bypass Amplify) ===');
    const result = await directCognitoAuth(user.trim(), pass);

    if (result.success) {
      Alert.alert('Direct Auth Success!', 'Check console for details. Amplify may have a configuration issue.');
    } else {
      Alert.alert('Direct Auth Failed', `Check console for details. Error: ${result.error?.__type || 'Unknown'}`);
    }
  };

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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
              Welcome to ScooterBooter
            </Text>
            <TextInput
              placeholder="Username or email"
              autoCapitalize="none"
              value={user}
              onChangeText={setUser}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }}
            />
            <TextInput
              placeholder="Password"
              secureTextEntry
              value={pass}
              onChangeText={setPass}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }}
            />
            <Button title="Log in" onPress={onLogin} />
            <View style={{ height: 8 }} />
            <Button title="Test Direct Cognito Auth" onPress={onDirectLogin} color="#666" />
            <View style={{ height: 8 }} />
            <Button title="Need an account? Sign up" onPress={() => navigation.navigate('Signup')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
