import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../components/Avatar';
import { useTheme } from '../theme';
import { markScoopViewed } from '../api/scoops';
import { ScoopFeedItem, Scoop } from '../types';
import { mediaUrlFromKey } from '../lib/media';

const { width, height } = Dimensions.get('window');
const PHOTO_DURATION = 5000; // 5 seconds per photo

export default function ScoopViewerScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { feedItems, startIndex = 0 } = route.params as {
    feedItems: ScoopFeedItem[];
    startIndex: number;
  };

  const [currentUserIndex, setCurrentUserIndex] = React.useState(startIndex);
  const [currentScoopIndex, setCurrentScoopIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const videoRef = React.useRef<Video>(null);
  const viewedScoopsRef = React.useRef<Set<string>>(new Set());

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const currentUser = feedItems[currentUserIndex];
  const currentScoop = currentUser?.scoops[currentScoopIndex];

  // Mark scoop as viewed
  React.useEffect(() => {
    if (currentScoop && !viewedScoopsRef.current.has(currentScoop.id)) {
      viewedScoopsRef.current.add(currentScoop.id);
      markScoopViewed(currentScoop.id).catch(err =>
        console.error('Failed to mark scoop as viewed:', err)
      );
    }
  }, [currentScoop]);

  // Auto-advance timer for photos
  React.useEffect(() => {
    if (!currentScoop || isPaused || currentScoop.mediaType === 'video') {
      return;
    }

    timerRef.current = setTimeout(() => {
      handleNext();
    }, PHOTO_DURATION);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentScoop, currentScoopIndex, currentUserIndex, isPaused]);

  const handleNext = () => {
    const nextScoopIndex = currentScoopIndex + 1;

    if (nextScoopIndex < currentUser.scoops.length) {
      // Move to next scoop in current user's scoops
      setCurrentScoopIndex(nextScoopIndex);
      setIsLoading(true);
    } else {
      // Move to next user
      const nextUserIndex = currentUserIndex + 1;
      if (nextUserIndex < feedItems.length) {
        setCurrentUserIndex(nextUserIndex);
        setCurrentScoopIndex(0);
        setIsLoading(true);
      } else {
        // No more scoops, close viewer
        navigation.goBack();
      }
    }
  };

  const handlePrevious = () => {
    if (currentScoopIndex > 0) {
      // Move to previous scoop in current user's scoops
      setCurrentScoopIndex(currentScoopIndex - 1);
      setIsLoading(true);
    } else {
      // Move to previous user
      const prevUserIndex = currentUserIndex - 1;
      if (prevUserIndex >= 0) {
        const prevUser = feedItems[prevUserIndex];
        setCurrentUserIndex(prevUserIndex);
        setCurrentScoopIndex(prevUser.scoops.length - 1);
        setIsLoading(true);
      }
    }
  };

  const handleTapLeft = () => {
    handlePrevious();
  };

  const handleTapRight = () => {
    handleNext();
  };

  const handleVideoPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (isLoading) {
        setIsLoading(false);
      }
      // Auto-advance when video ends
      if (status.didJustFinish) {
        handleNext();
      }
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  if (!currentUser || !currentScoop) {
    navigation.goBack();
    return null;
  }

  const mediaUrl = mediaUrlFromKey(currentScoop.mediaKey);
  const progressBarSegments = currentUser.scoops.length;

  return (
    <View style={styles.container}>
      {/* Media content */}
      {currentScoop.mediaType === 'video' ? (
        <Video
          ref={videoRef}
          source={{ uri: mediaUrl }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={!isPaused}
          isLooping={false}
          onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
          onLoad={() => setIsLoading(false)}
        />
      ) : (
        <Image
          source={{ uri: mediaUrl }}
          style={styles.media}
          resizeMode="contain"
          onLoad={handleImageLoad}
        />
      )}

      {/* Text overlays */}
      {currentScoop.textOverlay?.map((overlay, index) => (
        <View
          key={index}
          style={[
            styles.textOverlay,
            {
              left: `${overlay.position.x * 100}%`,
              top: `${overlay.position.y * 100}%`,
            },
          ]}
        >
          <Text
            style={[
              styles.overlayText,
              {
                fontFamily: overlay.font.includes('monospace') ? 'monospace' : undefined,
                color: overlay.color,
                fontWeight: overlay.font === 'system-bold' ? '700' : 'normal',
              },
            ]}
          >
            {overlay.text}
          </Text>
        </View>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      {/* Top gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradient}
      >
        <SafeAreaView edges={['top']}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {Array.from({ length: progressBarSegments }).map((_, index) => (
              <View key={index} style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        index < currentScoopIndex
                          ? '100%'
                          : index === currentScoopIndex
                          ? '50%'
                          : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* User info */}
          <View style={styles.userInfo}>
            <Avatar avatarKey={currentUser.avatarKey} size={36} />
            <Text style={styles.handle}>{currentUser.handle || 'User'}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Tap zones for navigation */}
      <View style={styles.tapZones}>
        <Pressable style={styles.tapZoneLeft} onPress={handleTapLeft} />
        <Pressable style={styles.tapZoneRight} onPress={handleTapRight} />
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'black',
    },
    media: {
      width: width,
      height: height,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    topGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingBottom: 20,
    },
    progressContainer: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingTop: 8,
      gap: 4,
    },
    progressBarBackground: {
      flex: 1,
      height: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 1.5,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: 'white',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    handle: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 10,
      flex: 1,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textOverlay: {
      position: 'absolute',
      transform: [{ translateX: -50 }, { translateY: -50 }],
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: 8,
      borderRadius: 4,
    },
    overlayText: {
      fontSize: 24,
      fontWeight: '600',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    tapZones: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
    },
    tapZoneLeft: {
      flex: 1,
    },
    tapZoneRight: {
      flex: 1,
    },
  });
