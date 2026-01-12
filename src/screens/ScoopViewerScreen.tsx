/**
 * ScoopViewerScreen
 * Full-screen viewer for a user's scoops with progress bars
 * Supports navigation between multiple scoops
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Alert } from 'react-native';
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
}

export default function ScoopViewerScreen({ navigation, route }: any) {
  const params = route.params as ScoopViewerScreenParams;
  const { currentUser } = useCurrentUser();

  // Get scoops from either userScoops or direct scoops array
  const initialScoops = params.userScoops?.scoops || params.scoops || [];
  const isOwner = params.isOwner ?? (params.userScoops?.userId === currentUser?.id);

  const [scoops, setScoops] = useState<Scoop[]>(initialScoops);
  const [currentIndex, setCurrentIndex] = useState(params.initialIndex || 0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewedScoops, setViewedScoops] = useState<Set<string>>(new Set());

  const currentScoop = scoops[currentIndex];

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
      setCurrentIndex((prev) => prev + 1);
    } else {
      navigation.goBack();
    }
  }, [currentIndex, scoops.length, navigation]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewViewers = useCallback(() => {
    if (currentScoop) {
      navigation.navigate('ScoopViewers', { scoopId: currentScoop.id });
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
        {scoops.map((scoop, index) => (
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
                  {
                    width: index < currentIndex ? '100%' : index === currentIndex ? '0%' : '0%',
                  },
                ]}
              />
            </View>
          </View>
        ))}
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
