/**
 * ScoopViewersScreen
 * Shows the list of users who have viewed a scoop
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { ScoopsAPI } from '../api';
import { ScoopViewer } from '../types';
import { useTheme, spacing, typography } from '../theme';

interface ScoopViewersScreenParams {
  scoopId: string;
}

export default function ScoopViewersScreen({ navigation, route }: any) {
  const params = route.params as ScoopViewersScreenParams;
  const { colors } = useTheme();
  const [viewers, setViewers] = useState<ScoopViewer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadViewers = useCallback(async () => {
    try {
      const data = await ScoopsAPI.getScoopViewers(params.scoopId);
      setViewers(data);
    } catch (error) {
      console.warn('[ScoopViewersScreen] Failed to load viewers:', error);
    } finally {
      setLoading(false);
    }
  }, [params.scoopId]);

  useEffect(() => {
    loadViewers();
  }, [loadViewers]);

  const handlePressViewer = useCallback(
    (viewer: ScoopViewer) => {
      navigation.navigate('Profile', {
        userId: viewer.userId,
        userHandle: viewer.handle,
      });
    },
    [navigation]
  );

  const renderViewer = useCallback(
    ({ item }: { item: ScoopViewer }) => (
      <TouchableOpacity
        style={[styles.viewerItem, { borderBottomColor: colors.border.light }]}
        onPress={() => handlePressViewer(item)}
        activeOpacity={0.7}
      >
        <Avatar avatarKey={item.avatarKey} size={48} />
        <View style={styles.viewerInfo}>
          <Text style={[styles.handle, { color: colors.text.primary }]}>
            {item.handle || 'User'}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [colors, handlePressViewer]
  );

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={viewers}
        keyExtractor={(item) => item.userId}
        renderItem={renderViewer}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              No one has viewed this scoop yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingVertical: spacing[2],
    },
    viewerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
    },
    viewerInfo: {
      marginLeft: spacing[3],
      flex: 1,
    },
    handle: {
      fontSize: typography.fontSize.base,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing[10],
    },
    emptyText: {
      fontSize: typography.fontSize.base,
    },
  });
