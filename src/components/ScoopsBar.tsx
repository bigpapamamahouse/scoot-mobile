/**
 * ScoopsBar Component
 * Horizontal scrollable list of user scoops at the top of the feed
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ScoopAvatar } from './ScoopAvatar';
import { ScoopsAPI } from '../api';
import { UserScoops, Scoop } from '../types';
import { useTheme, spacing, typography } from '../theme';
import { useCurrentUser } from '../hooks/useCurrentUser';

interface ScoopsBarProps {
  onPressScoops: (userScoops: UserScoops) => void;
  onPressCreate: () => void;
  onPressOwnScoops?: (scoops: Scoop[]) => void;
}

export const ScoopsBar: React.FC<ScoopsBarProps> = ({
  onPressScoops,
  onPressCreate,
  onPressOwnScoops,
}) => {
  const { colors } = useTheme();
  const { currentUser } = useCurrentUser();
  const [scoopsFeed, setScoopsFeed] = React.useState<UserScoops[]>([]);
  const [myScoops, setMyScoops] = React.useState<Scoop[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadScoops = React.useCallback(async () => {
    try {
      const [feed, mine] = await Promise.all([
        ScoopsAPI.getScoopsFeed(),
        ScoopsAPI.getMyScoops(),
      ]);
      setScoopsFeed(feed);
      setMyScoops(mine);
    } catch (error) {
      console.warn('[ScoopsBar] Failed to load scoops:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadScoops();
  }, [loadScoops]);

  const handlePressMyScoop = React.useCallback(() => {
    if (myScoops.length > 0 && onPressOwnScoops) {
      onPressOwnScoops(myScoops);
    } else {
      onPressCreate();
    }
  }, [myScoops, onPressOwnScoops, onPressCreate]);

  const renderScoopItem = React.useCallback(
    ({ item }: { item: UserScoops }) => (
      <View style={styles.scoopItem}>
        <ScoopAvatar
          avatarKey={item.avatarKey}
          size={64}
          hasUnviewed={item.hasUnviewed}
          onPress={() => onPressScoops(item)}
        />
        <Text
          style={[styles.handle, { color: colors.text.secondary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.handle || 'User'}
        </Text>
      </View>
    ),
    [colors.text.secondary, onPressScoops]
  );

  const styles = React.useMemo(
    () => createStyles(colors),
    [colors]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  }

  // Don't show the bar if there are no scoops to display
  if (scoopsFeed.length === 0 && myScoops.length === 0) {
    return (
      <View style={styles.container}>
        {/* Just show the "Your Scoop" button */}
        <View style={styles.scoopItem}>
          <ScoopAvatar
            avatarKey={currentUser?.avatarKey}
            size={64}
            hasUnviewed={false}
            onPress={onPressCreate}
            showAddButton
          />
          <Text
            style={[styles.handle, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            Your Scoop
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={scoopsFeed}
        keyExtractor={(item) => item.userId}
        renderItem={renderScoopItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.scoopItem}>
            <ScoopAvatar
              avatarKey={currentUser?.avatarKey}
              size={64}
              hasUnviewed={false}
              onPress={handlePressMyScoop}
              showAddButton={myScoops.length === 0}
            />
            <Text
              style={[styles.handle, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              {myScoops.length > 0 ? 'Your Scoop' : 'Add Scoop'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.primary,
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    loadingContainer: {
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: spacing[3],
    },
    scoopItem: {
      alignItems: 'center',
      marginRight: spacing[3],
      width: 72,
    },
    handle: {
      marginTop: spacing[1],
      fontSize: typography.fontSize.xs,
      textAlign: 'center',
      width: '100%',
    },
  });

export default ScoopsBar;
