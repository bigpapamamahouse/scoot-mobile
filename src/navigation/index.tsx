
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { palette } from '../theme/colors';
import { GlassCard } from '../components/ui/GlassCard';

const Stack = createNativeStackNavigator();

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

function HeaderActions({ navigation }: { navigation: any }) {
  const { unreadCount } = useNotifications();
  const safeUnreadCount = typeof unreadCount === 'number' ? unreadCount : 0;
  const notificationLabel = safeUnreadCount > 9 ? '9+' : safeUnreadCount.toString();
  return (
    <GlassCard style={styles.headerGlass} contentStyle={styles.headerGlassContent} accessibilityRole="toolbar">
      <TouchableOpacity
        onPress={() => navigation.navigate('Search')}
        style={styles.headerIconButton}
        hitSlop={HIT_SLOP}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        <Ionicons name="search-outline" size={22} color={palette.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={styles.headerIconButton}
        hitSlop={HIT_SLOP}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <View style={styles.notificationIconWrapper}>
          <Ionicons
            name={safeUnreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color={palette.textPrimary}
          />
          {safeUnreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{notificationLabel}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        style={styles.headerIconButton}
        hitSlop={HIT_SLOP}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <Ionicons name="person-circle-outline" size={22} color={palette.textPrimary} />
      </TouchableOpacity>
    </GlassCard>
  );
}

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'rgba(15,23,42,0.85)',
    text: palette.textPrimary,
    border: 'rgba(148,163,184,0.35)',
    primary: palette.accent,
  },
};

export default function RootNavigator(){
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: 'rgba(15,23,42,0.85)',
          },
          headerTitleStyle: {
            color: palette.textPrimary,
            fontWeight: '700',
            letterSpacing: 0.5,
          },
          headerTintColor: palette.textPrimary,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: 'transparent',
          },
        }}
      >
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

const styles = StyleSheet.create({
  headerGlass: {
    marginRight: 4,
    borderRadius: 999,
    minWidth: 132,
  },
  headerGlassContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  headerIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e53935',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});
