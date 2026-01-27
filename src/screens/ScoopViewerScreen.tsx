/**
 * ScoopViewerScreen
 * Full-screen viewer for a user's scoops with progress bars
 * Supports navigation between multiple scoops
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScoopViewer } from '../components/ScoopViewer';
import { ScoopsAPI } from '../api';
import { Scoop, UserScoops } from '../types';
import { useCurrentUser } from '../hooks/useCurrentUser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScoopViewerScreenParams {
  userScoops?: UserScoops;
  scoops?: Scoop[];
  initialIndex?: number;
  isOwner?: boolean;
  allUserScoops?: UserScoops[]; // Full feed for autoplay between users
}

export default function ScoopViewerScreen({ navigation, route }: any) {
  const params = route.params as ScoopViewerScreenParams;
  const { currentUser } = useCurrentUser();

  // Get scoops from either userScoops or direct scoops array
  const initialScoops = params.userScoops?.scoops || params.scoops || [];
  const allUserScoops = params.allUserScoops || [];

  const [scoops, setScoops] = useState<Scoop[]>(initialScoops);
  const [currentIndex, setCurrentIndex] = useState(params.initialIndex || 0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewedScoops, setViewedScoops] = useState<Set<string>>(new Set());
  const [currentProgress, setCurrentProgress] = useState(0);
  // Track which users we've visited during this session for autoplay
  const [visitedUsers, setVisitedUsers] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (params.userScoops?.userId) {
      initial.add(params.userScoops.userId);
    }
    return initial;
  });
  // Track current user for display purposes
  const [currentUserScoops, setCurrentUserScoops] = useState<UserScoops | undefined>(params.userScoops);

  const currentScoop = scoops[currentIndex];
  // Compute isOwner dynamically based on current user being viewed
  const isOwner = params.isOwner ?? (currentUserScoops?.userId === currentUser?.id);

  // Pause when screen loses focus (e.g., navigating to viewers), resume when focused
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsPaused(false);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsPaused(true);
    });
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  // Reset progress when scoop changes
  useEffect(() => {
    setCurrentProgress(0);
  }, [currentIndex]);

  const handleProgressUpdate = useCallback((progress: number) => {
    setCurrentProgress(progress);
  }, []);

  // Mark scoop as viewed when displayed
  useEffect(() => {
    if (!currentScoop || isOwner) return;

    if (!viewedScoops.has(currentScoop.id)) {
      ScoopsAPI.markScoopViewed(currentScoop.id);
      setViewedScoops((prev) => new Set(prev).add(currentScoop.id));
    }
  }, [currentScoop?.id, isOwner, viewedScoops]);

  const handleComplete = useCallback(() => {
    if (currentIndex < scoops.length - 1) {
      // More scoops from current user
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Find next user with unviewed scoops that we haven't visited yet
      const nextUserScoops = allUserScoops.find(
        (us) => us.hasUnviewed && !visitedUsers.has(us.userId)
      );

      if (nextUserScoops) {
        // Switch to next user's scoops
        setVisitedUsers((prev) => new Set(prev).add(nextUserScoops.userId));
        setCurrentUserScoops(nextUserScoops);
        setScoops(nextUserScoops.scoops);
        // Start from first unviewed scoop
        const firstUnviewedIndex = nextUserScoops.scoops.findIndex(s => !s.viewed);
        setCurrentIndex(firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0);
        setCurrentProgress(0);
      } else {
        // No more unviewed scoops from other users
        navigation.goBack();
      }
    }
  }, [currentIndex, scoops.length, navigation, allUserScoops, visitedUsers]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewViewers = useCallback(() => {
    console.log('[ScoopViewerScreen] handleViewViewers called, currentScoop:', currentScoop?.id);
    if (currentScoop) {
      console.log('[ScoopViewerScreen] Pushing ScoopViewers with scoopId:', currentScoop.id);
      navigation.push('ScoopViewers', { scoopId: currentScoop.id });
    } else {
      console.log('[ScoopViewerScreen] currentScoop is falsy, not navigating');
    }
  }, [currentScoop, navigation]);

  const handleDelete = useCallback(() => {
    if (!currentScoop || !isOwner) return;

    Alert.alert(
      'Delete Scoop',
      'Are you sure you want to delete this scoop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ScoopsAPI.deleteScoop(currentScoop.id);

              // Remove from local state
              const newScoops = scoops.filter(s => s.id !== currentScoop.id);

              if (newScoops.length === 0) {
                navigation.goBack();
              } else {
                setScoops(newScoops);
                // Adjust index if needed
                if (currentIndex >= newScoops.length) {
                  setCurrentIndex(newScoops.length - 1);
                }
              }
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete scoop');
            }
          },
        },
      ]
    );
  }, [currentScoop, isOwner, scoops, currentIndex, navigation]);

  if (!currentScoop || scoops.length === 0) {
    navigation.goBack();
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Progress indicators for all scoops */}
      <View style={styles.progressBarsContainer}>
        {scoops.map((scoop, index) => {
          let fillWidth: string;
          if (index < currentIndex) {
            fillWidth = '100%';
          } else if (index === currentIndex) {
            fillWidth = `${currentProgress * 100}%`;
          } else {
            fillWidth = '0%';
          }

          return (
            <View
              key={scoop.id}
              style={[
                styles.progressBarWrapper,
                { width: (SCREEN_WIDTH - 32 - (scoops.length - 1) * 4) / scoops.length },
              ]}
            >
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: fillWidth },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <ScoopViewer
        scoop={currentScoop}
        isActive={true}
        onComplete={handleComplete}
        onPrevious={handlePrevious}
        onClose={handleClose}
        isPaused={isPaused}
        onPauseChange={setIsPaused}
        isOwner={isOwner}
        onViewViewers={handleViewViewers}
        onDelete={isOwner ? handleDelete : undefined}
        onProgressUpdate={handleProgressUpdate}
        hideProgressBar={scoops.length > 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressBarsContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 100,
  },
  progressBarWrapper: {
    height: 3,
  },
  progressBarBackground: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
});
