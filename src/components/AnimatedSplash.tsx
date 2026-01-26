import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../theme';

// Keep the splash screen visible while we prepare our animated version
SplashScreen.preventAutoHideAsync();

interface AnimatedSplashProps {
  children: React.ReactNode;
  isReady: boolean;
}

const { width } = Dimensions.get('window');

export default function AnimatedSplash({ children, isReady }: AnimatedSplashProps) {
  const [showSplash, setShowSplash] = useState(true);
  const { effectiveMode } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Theme-aware colors
  const isDark = effectiveMode === 'dark';
  const backgroundColor = isDark ? '#1a1a2e' : '#ffffff';

  useEffect(() => {
    // Start the logo entrance animation
    const startAnimation = async () => {
      // Hide the native splash screen
      await SplashScreen.hideAsync();

      // Run the logo entrance animation (fade in + scale with bounce)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    };

    startAnimation();
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    if (isReady) {
      // Add a small delay to let user appreciate the animation
      const timer = setTimeout(() => {
        // Animate the splash screen out
        Animated.parallel([
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1.5,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowSplash(false);
        });
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isReady, splashOpacity, logoScale]);

  if (!showSplash) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Render children behind the splash */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>

      {/* Animated splash overlay */}
      <Animated.View
        style={[
          styles.splashContainer,
          { opacity: splashOpacity, backgroundColor },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={isDark
              ? require('../../assets/scoot_lite.png')
              : require('../../assets/scoot.png')
            }
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.6,
    height: width * 0.25,
  },
});
