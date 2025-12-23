import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Text,
  RefreshControl,
} from 'react-native';
import { ScoopRing } from './ScoopRing';
import { useTheme } from '../theme';
import { getScoopsFeed } from '../api/scoops';
import { ScoopFeedItem } from '../types';
import { useAuth } from '../auth/AuthContext';

interface ScoopsRowProps {
  onScoopPress: (item: ScoopFeedItem, userIndex: number, allItems: ScoopFeedItem[]) => void;
  onCreatePress: () => void;
}

export const ScoopsRow = ({ onScoopPress, onCreatePress }: ScoopsRowProps) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [scoops, setScoops] = React.useState<ScoopFeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const loadScoops = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getScoopsFeed();
      setScoops(result.items || []);
    } catch (error) {
      console.error('Error loading scoops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    loadScoops();
  }, []);

  const handleRefresh = () => {
    loadScoops(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (scoops.length === 0 && !user) {
    return null; // Don't show empty state if no scoops and no user
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Your Scoop button (always first if user is logged in) */}
      {user && (
        <ScoopRing
          avatarKey={user.avatarKey}
          handle={user.handle || 'You'}
          hasNew={false}
          isOwn={true}
          onPress={onCreatePress}
        />
      )}

      {/* Scoops from followed users */}
      {scoops.map((item, index) => (
        <ScoopRing
          key={item.userId}
          avatarKey={item.avatarKey}
          handle={item.handle}
          hasNew={item.hasNew}
          onPress={() => onScoopPress(item, index, scoops)}
        />
      ))}

      {/* Empty state */}
      {scoops.length === 0 && user && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No scoops yet. Follow users to see their scoops!
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyContainer: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 200,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
