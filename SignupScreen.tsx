import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUpFn } from '../../api/auth';

export default function SignupScreen({ navigation }: any) {
  const [user, setUser] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');

  const onSignup = async () => {
    try {
      await signUpFn(user, pass, email);
      navigation.navigate('ConfirmCode', { username: user });
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message || String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Create account</Text>
            <TextInput placeholder="Username" autoCapitalize="none" value={user} onChangeText={setUser}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }} />
            <TextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }} />
            <TextInput placeholder="Password" secureTextEntry value={pass} onChangeText={setPass}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }} />
            <Button title="Sign up" onPress={onSignup} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
