import React from 'react';
import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmSignUpFn } from '../../api/auth';
import { useTheme } from '../../theme/ThemeContext';

export default function ConfirmCodeScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const email = route?.params?.email || '';
  const password = route?.params?.password || '';
  const [code, setCode] = React.useState('');

  const onConfirm = async () => {
    if (!code) {
      Alert.alert('Missing code', 'Please enter the verification code');
      return;
    }

    try {
      await confirmSignUpFn(email, code);
      // Navigate to ClaimUsername screen instead of Login
      navigation.navigate('ClaimUsername', { email, password });
    } catch (e: any) {
      Alert.alert('Confirm failed', e?.message || String(e));
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
        <ScrollView contentContainerStyle={{ minHeight: '100%', justifyContent: 'center', paddingVertical: 48 }}>
          <View style={{ padding: 24, gap: 12, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: colors.text.primary }}>
              Confirm your code
            </Text>
            <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 16, color: colors.text.secondary }}>
              We sent a verification code to {email}
            </Text>
            <TextInput
              placeholder="Verification Code"
              placeholderTextColor={colors.text.tertiary}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              style={inputStyle}
            />
            <Button title="Confirm" onPress={onConfirm} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
