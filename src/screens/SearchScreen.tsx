import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchUsers } from '../api/users';
import { Avatar } from '../components/Avatar';
import type { User } from '../types';
import { ModernScreen } from '../components/ui/ModernScreen';
import { GlassCard } from '../components/ui/GlassCard';
import { palette } from '../theme/colors';

type RootStackParamList = {
  Search: undefined;
  Profile: { userHandle?: string; userId?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      style={styles.userTouchable}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.85}
    >
      <GlassCard style={styles.userCard} contentStyle={styles.userCardContent}>
        <View style={styles.userRow}>
          <Avatar avatarKey={item.avatarKey} size={52} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.fullName || 'Unknown rider'}</Text>
            <Text style={styles.userHandle}>@{item.handle || 'unknown'}</Text>
          </View>
        </View>
      </GlassCard>
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
    <ModernScreen edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <View style={styles.searchContainer}>
        <GlassCard style={styles.searchCard} contentStyle={styles.searchCardContent}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search riders by name or handle"
            placeholderTextColor={palette.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
        </GlassCard>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      )}

      <FlatList
        data={results}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id || item.handle || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </ModernScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchCard: {
    width: '100%',
  },
  searchCardContent: {
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  searchInput: {
    height: 44,
    fontSize: 16,
    color: palette.textPrimary,
  },
  loadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 100,
    gap: 16,
  },
  userTouchable: {
    width: '100%',
  },
  userCard: {
    width: '100%',
  },
  userCardContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 15,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
