/**
 * ScoopsBar Component
 * Horizontal scrollable list of user scoops at the top of the feed
 */

import React, { forwardRef, useImperativeHandle } from 'react';
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
import { useUpload } from '../contexts/UploadContext';

interface ScoopsBarProps {
  onPressScoops: (userScoops: UserScoops) => void;
  onPressCreate: () => void;
  onPressOwnScoops?: (scoops: Scoop[]) => void;
}

export interface ScoopsBarRef {
  refresh: () => Promise<void>;
}

export const ScoopsBar = forwardRef<ScoopsBarRef, ScoopsBarProps>(({
  onPressScoops,
  onPressCreate,
  onPressOwnScoops,
}, ref) => {
  const { colors } = useTheme();
  const { currentUser } = useCurrentUser();
  const { isUploading, onUploadSuccess } = useUpload();
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

  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: loadScoops,
  }), [loadScoops]);

  // Refresh scoops when upload succeeds
  React.useEffect(() => {
    const unsubscribe = onUploadSuccess(() => {
      console.log('[ScoopsBar] Upload succeeded, refreshing scoops');
      loadScoops();
    });
    return unsubscribe;
  }, [onUploadSuccess, loadScoops]);

  const handlePressViewMyScoop = React.useCallback(() => {
    if (myScoops.length > 0 && onPressOwnScoops) {
      onPressOwnScoops(myScoops);
    }
  }, [myScoops, onPressOwnScoops]);

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

  // Sort scoops feed to show unviewed first
  const sortedScoopsFeed = React.useMemo(() => {
    return [...scoopsFeed].sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }, [scoopsFeed]);

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

  // Show minimal bar when there are no other users' scoops
  if (sortedScoopsFeed.length === 0) {
    return (
      <View style={[styles.container, styles.minimalContainer]}>
        {/* Add scoop button - always visible, shown first */}
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
            Add Scoop
          </Text>
        </View>
        {/* Uploading indicator */}
        {isUploading && (
          <View style={styles.scoopItem}>
            <View style={styles.uploadingAvatar}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
            </View>
            <Text
              style={[styles.handle, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              Uploading...
            </Text>
          </View>
        )}
        {/* User's scoop - shown when they have scoops (hide while uploading) */}
        {!isUploading && myScoops.length > 0 && (
          <View style={styles.scoopItem}>
            <ScoopAvatar
              avatarKey={currentUser?.avatarKey}
              size={64}
              hasUnviewed={true}
              onPress={handlePressViewMyScoop}
            />
            <Text
              style={[styles.handle, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              Your Scoop
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={sortedScoopsFeed}
        keyExtractor={(item) => item.userId}
        renderItem={renderScoopItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Add scoop button - always visible, shown first */}
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
                Add Scoop
              </Text>
            </View>
            {/* Uploading indicator */}
            {isUploading && (
              <View style={styles.scoopItem}>
                <View style={styles.uploadingAvatar}>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                </View>
                <Text
                  style={[styles.handle, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  Uploading...
                </Text>
              </View>
            )}
            {/* User's scoop - shown when they have scoops (hide while uploading) */}
            {!isUploading && myScoops.length > 0 && (
              <View style={styles.scoopItem}>
                <ScoopAvatar
                  avatarKey={currentUser?.avatarKey}
                  size={64}
                  hasUnviewed={true}
                  onPress={handlePressViewMyScoop}
                />
                <Text
                  style={[styles.handle, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  Your Scoop
                </Text>
              </View>
            )}
          </>
        }
      />
    </View>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.elevated,
      paddingVertical: spacing[3],
      borderRadius: 16,
      marginBottom: spacing[3],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    minimalContainer: {
      flexDirection: 'row',
      paddingHorizontal: spacing[3],
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
    uploadingAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.neutral[200],
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.primary[400],
    },
  });

export default ScoopsBar;
