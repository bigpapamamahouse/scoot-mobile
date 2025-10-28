
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import ConfirmCodeScreen from '../screens/Auth/ConfirmCodeScreen';
import ClaimUsernameScreen from '../screens/Auth/ClaimUsernameScreen';
import ComposePostScreen from '../screens/ComposePostScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator(){
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign up' }} />
        <Stack.Screen name="ConfirmCode" component={ConfirmCodeScreen} options={{ title: 'Confirm' }} />
        <Stack.Screen name="ClaimUsername" component={ClaimUsernameScreen} options={{ title: 'Choose username' }} />
        <Stack.Screen
          name="Feed"
          component={FeedScreen}
          options={({ navigation }) => ({
            title: 'Feed',
            headerRight: () => {
              const { TouchableOpacity, Text } = require('react-native');
              return (
                <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 24 }}>👤</Text>
                </TouchableOpacity>
              );
            },
          })}
        />
        <Stack.Screen name="ComposePost" component={ComposePostScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
