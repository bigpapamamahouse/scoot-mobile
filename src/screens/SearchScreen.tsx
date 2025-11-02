import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchUsers } from '../api/users';
import { Avatar } from '../components/Avatar';
import type { User } from '../types';
import { useTheme, spacing, typography, borderRadius } from '../theme';

type RootStackParamList = {
  Search: undefined;
  Profile: { userHandle?: string; userId?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Debounced search effect
  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const searchResults = await searchUsers(trimmedQuery);
        setResults(searchResults);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search users. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

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

    if (query.trim().length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Search for users by name or handle</Text>
        </View>
      );
    }

    if (query.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No users found</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      <FlatList
        data={results}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id || item.handle || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.elevated,
  },
  searchContainer: {
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchInput: {
    height: 44,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing[4],
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  loadingContainer: {
    padding: spacing[5],
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  userInfo: {
    marginLeft: spacing[3],
    flex: 1,
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  userHandle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[5],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
