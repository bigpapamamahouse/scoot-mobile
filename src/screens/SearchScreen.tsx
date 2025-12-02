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
import { searchUsersWithMutuals, getSuggestedUsers } from '../api/users';
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
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Fetch suggested users on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const suggestions = await getSuggestedUsers();
        setSuggestedUsers(suggestions);
      } catch (err) {
        console.error('Failed to fetch suggested users:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, []);

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
        const searchResults = await searchUsersWithMutuals(trimmedQuery);
        setResults(searchResults);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search scooters. Please try again.');
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
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{item.fullName || 'Unknown'}</Text>
          {item.hasMutualConnection && (
            <View style={styles.mutualBadge}>
              <Text style={styles.mutualBadgeText}>Mutual</Text>
            </View>
          )}
        </View>
        <Text style={styles.userHandle}>@{item.handle || 'unknown'}</Text>
        {item.mutualFriendCount && item.mutualFriendCount > 0 && (
          <Text style={styles.mutualFriendsText}>
            Followed by {item.mutualFriendCount} friend{item.mutualFriendCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  ), [handleUserPress, styles]);

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
          <Text style={styles.emptyText}>Search for scooters by name or handle</Text>
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
        <Text style={styles.emptyText}>No scooters found</Text>
      </View>
    );
  };

  // Determine which data to display
  const displayData = query.trim().length === 0 ? suggestedUsers : results;
  const showSuggestionsHeader = query.trim().length === 0 && suggestedUsers.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search scooters..."
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
        />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      {loadingSuggestions && query.trim().length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      <FlatList
        data={displayData}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id || item.handle || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          showSuggestionsHeader ? (
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsHeaderText}>Suggested for you</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  mutualBadge: {
    marginLeft: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    backgroundColor: colors.primary[100] || colors.primary[500] + '20',
    borderRadius: borderRadius.sm,
  },
  mutualBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700] || colors.primary[500],
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
  suggestionsHeader: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    backgroundColor: colors.background.elevated,
  },
  suggestionsHeaderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mutualFriendsText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing[1],
  },
});
