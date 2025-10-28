// src/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { signOutFn } from '../api/auth';

export default function SettingsScreen({ navigation }: any) {
  const handleLogout = async () => {
    await signOutFn();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>Settings</Text>
      <Button title="Log out" onPress={handleLogout} />
    </View>
  );
}
