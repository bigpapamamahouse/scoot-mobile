/**
 * MyScoopsScreen
 * Shows the user's own scoops with time remaining, view counts, and management options
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScoopsAPI } from '../api';
import { Scoop } from '../types';
import { useTheme, spacing, typography } from '../theme';
import { mediaUrlFromKey } from '../lib/media';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - spacing[4] * 2 - spacing[2] * 2) / 3;

interface MyScoopsScreenParams {
  initialScoops?: Scoop[];
}

const formatTimeRemaining = (expiresAt: number): string => {
  const now = Date.now();
  const remaining = expiresAt - now;

  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
};

const formatTimePosted = (createdAt: number): string => {
  const now = Date.now();
  const diff = now - createdAt;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'Just now';
};

export default function MyScoopsScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const params = route.params as MyScoopsScreenParams | undefined;

  const [scoops, setScoops] = useState<Scoop[]>(params?.initialScoops || []);
  const [loading, setLoading] = useState(!params?.initialScoops);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadScoops = useCallback(async () => {
    try {
      const myScoops = await ScoopsAPI.getMyScoops();
      setScoops(myScoops);
    } catch (error) {
      console.warn('[MyScoopsScreen] Failed to load scoops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!params?.initialScoops) {
      loadScoops();
    }
  }, [loadScoops, params?.initialScoops]);

  // Refresh on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadScoops();
    });
    return unsubscribe;
  }, [navigation, loadScoops]);

  // Update time remaining every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setScoops((prev) => [...prev]); // Force re-render
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadScoops();
  }, [loadScoops]);

  const handleViewScoop = useCallback(
    (scoop: Scoop, index: number) => {
      navigation.navigate('ScoopViewer', {
        scoops,
        initialIndex: index,
        isOwner: true,
      });
    },
    [navigation, scoops]
  );

  const handleViewViewers = useCallback(
    (scoopId: string) => {
      navigation.navigate('ScoopViewers', { scoopId });
    },
    [navigation]
  );

  const handleDeleteScoop = useCallback(
    (scoop: Scoop) => {
      Alert.alert(
        'Delete Scoop',
        'Are you sure you want to delete this scoop? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(scoop.id);
              try {
                await ScoopsAPI.deleteScoop(scoop.id);
                setScoops((prev) => prev.filter((s) => s.id !== scoop.id));
              } catch (error) {
                console.warn('[MyScoopsScreen] Failed to delete scoop:', error);
                Alert.alert('Error', 'Failed to delete scoop. Please try again.');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    []
  );

  const handleCreateScoop = useCallback(() => {
    navigation.navigate('CreateScoop');
  }, [navigation]);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const renderScoop = useCallback(
    ({ item, index }: { item: Scoop; index: number }) => {
      const mediaUrl = mediaUrlFromKey(item.mediaKey);
      const isDeleting = deletingId === item.id;
      const timeRemaining = formatTimeRemaining(item.expiresAt);
      const timePosted = formatTimePosted(item.createdAt);
      const isExpired = item.expiresAt <= Date.now();

      return (
        <TouchableOpacity
          style={[styles.scoopCard, isExpired && styles.expiredCard]}
          onPress={() => handleViewScoop(item, index)}
          disabled={isDeleting || isExpired}
          activeOpacity={0.8}
        >
          {/* Thumbnail */}
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: mediaUrl || '' }}
              style={styles.thumbnail}
              resizeMode="cover"
            />

            {/* Video indicator */}
            {item.mediaType === 'video' && (
              <View style={styles.videoIndicator}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            )}

            {/* Expired overlay */}
            {isExpired && (
              <View style={styles.expiredOverlay}>
                <Text style={styles.expiredText}>Expired</Text>
              </View>
            )}

            {/* Deleting overlay */}
            {isDeleting && (
              <View style={styles.deletingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}

            {/* Time remaining badge */}
            {!isExpired && (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.timeGradient}
              >
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={12} color="#fff" />
                  <Text style={styles.timeText}>{timeRemaining}</Text>
                </View>
              </LinearGradient>
            )}
          </View>

          {/* Info section */}
          <View style={styles.infoContainer}>
            <Text style={styles.postedTime}>{timePosted}</Text>

            {/* Actions row */}
            <View style={styles.actionsRow}>
              {/* Views button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleViewViewers(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="eye-outline"
                  size={16}
                  color={colors.text.secondary}
                />
                <Text style={styles.actionText}>{item.viewCount || 0}</Text>
              </TouchableOpacity>

              {/* Delete button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteScoop(item)}
                disabled={isDeleting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={colors.status.error}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      colors,
      styles,
      deletingId,
      handleViewScoop,
      handleViewViewers,
      handleDeleteScoop,
    ]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>My Scoops</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Scoops</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateScoop}
        >
          <Ionicons name="add" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {scoops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="camera-outline"
            size={64}
            color={colors.text.tertiary}
          />
          <Text style={styles.emptyTitle}>No Scoops Yet</Text>
          <Text style={styles.emptySubtitle}>
            Share a moment that disappears in 24 hours
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateScoop}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create Scoop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scoops}
          keyExtractor={(item) => item.id}
          renderItem={renderScoop}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
            />
          }
          ListHeaderComponent={
            <View style={styles.statsHeader}>
              <Text style={styles.statsText}>
                {scoops.length} active {scoops.length === 1 ? 'scoop' : 'scoops'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: '600',
      color: colors.text.primary,
    },
    addButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholder: {
      width: 40,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: spacing[4],
    },
    columnWrapper: {
      gap: spacing[2],
      marginBottom: spacing[2],
    },
    statsHeader: {
      marginBottom: spacing[3],
    },
    statsText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    scoopCard: {
      width: THUMBNAIL_SIZE,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      overflow: 'hidden',
    },
    expiredCard: {
      opacity: 0.6,
    },
    thumbnailContainer: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoIndicator: {
      position: 'absolute',
      top: spacing[2],
      right: spacing[2],
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 12,
      padding: 4,
    },
    expiredOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    expiredText: {
      color: '#fff',
      fontSize: typography.fontSize.sm,
      fontWeight: '600',
    },
    deletingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
      justifyContent: 'flex-end',
      paddingBottom: spacing[1],
      paddingHorizontal: spacing[1],
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    timeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '500',
    },
    infoContainer: {
      padding: spacing[2],
    },
    postedTime: {
      fontSize: 10,
      color: colors.text.tertiary,
      marginBottom: spacing[1],
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
    emptyTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: '600',
      color: colors.text.primary,
      marginTop: spacing[4],
    },
    emptySubtitle: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: spacing[2],
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary[500],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderRadius: 24,
      marginTop: spacing[6],
      gap: spacing[2],
    },
    createButtonText: {
      color: '#fff',
      fontSize: typography.fontSize.base,
      fontWeight: '600',
    },
  });
