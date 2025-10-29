import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listFollowers, listFollowing } from '../api/users';
import { Avatar } from '../components/Avatar';
import type { User } from '../types';

type RootStackParamList = {
  UserList: { handle: string; type: 'followers' | 'following' };
  Profile: { userHandle?: string; userId?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'UserList'>;

export function UserListScreen({ route, navigation }: Props) {
  const { handle, type } = route.params;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const fetchFunction = type === 'followers' ? listFollowers : listFollowing;
      const response = await fetchFunction(handle);

      // Handle different response formats
      let userList: User[] = [];
      if (Array.isArray(response)) {
        userList = response;
      } else if (response && typeof response === 'object') {
        if ('items' in response && Array.isArray(response.items)) {
          userList = response.items;
        } else if ('users' in response && Array.isArray(response.users)) {
          userList = response.users;
        } else if ('followers' in response && Array.isArray(response.followers)) {
          userList = response.followers;
        } else if ('following' in response && Array.isArray(response.following)) {
          userList = response.following;
        }
      }

      setUsers(userList);
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
      setError(`Failed to load ${type}. Please try again.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handle, type]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers(false);
  }, [fetchUsers]);

  const handleUserPress = useCallback((user: User) => {
    navigation.push('Profile', {
      userHandle: user.handle,
      userId: user.id || undefined,
    });
  }, [navigation]);

  const renderUserItem = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
    >
      <Avatar avatarKey={item.avatarKey} size={48} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName || 'Unknown'}</Text>
        <Text style={styles.userHandle}>@{item.handle || 'unknown'}</Text>
      </View>
    </TouchableOpacity>
  ), [handleUserPress]);

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
        </View>
      )}

      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id || item.handle || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
