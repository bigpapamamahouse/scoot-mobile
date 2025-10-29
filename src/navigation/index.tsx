
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View } from 'react-native';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import ConfirmCodeScreen from '../screens/Auth/ConfirmCodeScreen';
import ClaimUsernameScreen from '../screens/Auth/ClaimUsernameScreen';
import ComposePostScreen from '../screens/ComposePostScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { UserListScreen } from '../screens/UserListScreen';
import { useNotifications } from '../lib/notifications';

const Stack = createNativeStackNavigator();

function HeaderActions({ navigation }: { navigation: any }) {
  const { unreadCount } = useNotifications();
  const notificationLabel = unreadCount > 9 ? '9+' : unreadCount.toString();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 24 }}>🔍</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ paddingHorizontal: 12 }}>
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24 }}>🔔</Text>
          {unreadCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -8,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#e53935',
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{notificationLabel}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 24 }}>👤</Text>
      </TouchableOpacity>
    </View>
  );
}

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
            headerRight: () => <HeaderActions navigation={navigation} />,
          })}
        />
        <Stack.Screen name="ComposePost" component={ComposePostScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="Search" component={SearchScreen as any} options={{ title: 'Search Users' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen
          name="UserList"
          component={UserListScreen as any}
          options={({ route }: any) => ({
            title: route.params?.type === 'followers' ? 'Followers' : 'Following'
          })}
        />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
