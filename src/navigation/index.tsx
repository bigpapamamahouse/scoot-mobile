
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
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
import PostScreen from '../screens/PostScreen';
import { IconButton, Badge } from '../components/ui';
import { useTheme, spacing } from '../theme';

const Stack = createNativeStackNavigator();

function HeaderActions({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
      <IconButton
        icon="search-outline"
        onPress={() => navigation.navigate('Search')}
        variant="ghost"
        size="md"
        color={colors.text.primary}
      />

      <View style={{ position: 'relative' }}>
        <IconButton
          icon="notifications-outline"
          onPress={() => navigation.navigate('Notifications')}
          variant="ghost"
          size="md"
          color={colors.text.primary}
        />
        {unreadCount > 0 && (
          <Badge
            count={unreadCount}
            variant="error"
            size="sm"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
          />
        )}
      </View>

      <IconButton
        icon="person-outline"
        onPress={() => navigation.navigate('Profile')}
        variant="ghost"
        size="md"
        color={colors.text.primary}
      />
    </View>
  );
}

export default function RootNavigator(){
  const { colors, effectiveMode } = useTheme();

  const navigationTheme = {
    dark: effectiveMode === 'dark',
    colors: {
      primary: colors.primary[500],
      background: colors.background.primary,
      card: colors.background.elevated,
      text: colors.text.primary,
      border: colors.border.light,
      notification: colors.error.main,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
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
        <Stack.Screen
          name="Post"
          component={PostScreen}
          options={{ title: 'Post' }}
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
