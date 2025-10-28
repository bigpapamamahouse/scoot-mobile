import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmSignUpFn } from '../../api/auth';

export default function ConfirmCodeScreen({ route, navigation }: any) {
  const username = route?.params?.username || '';
  const [code, setCode] = React.useState('');

  const onConfirm = async () => {
    try {
      await confirmSignUpFn(username, code);
      Alert.alert('Confirmed', 'Your account is confirmed');
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Confirm failed', e?.message || String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Confirm your code</Text>
            <TextInput placeholder="Code" value={code} onChangeText={setCode} keyboardType="number-pad"
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 }} />
            <Button title="Confirm" onPress={onConfirm} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
