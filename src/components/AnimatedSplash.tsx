import React, { useEffect, useRef, useState } from 'react';
import {
  View,
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

// Colors
const LIGHT_BG = '#ffffff';
const DARK_BG = '#1a1a2e';

export default function AnimatedSplash({ children, isReady }: AnimatedSplashProps) {
  const [showSplash, setShowSplash] = useState(true);
  const { effectiveMode } = useTheme();
  const isDark = effectiveMode === 'dark';

  // Animation values - start visible to match native splash (white bg)
  const logoScale = useRef(new Animated.Value(1)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Theme transition: 0 = light (native splash), 1 = dark
  const themeTransition = useRef(new Animated.Value(0)).current;

  // Interpolate background color from white to dark
  const backgroundColor = themeTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_BG, DARK_BG],
  });

  // Cross-fade between logos: light logo fades out, dark logo fades in
  const lightLogoOpacity = themeTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const darkLogoOpacity = themeTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  useEffect(() => {
    const startAnimation = async () => {
      // Hide the native splash screen - logo is already visible so no flash
      await SplashScreen.hideAsync();

      // Run animations in parallel: pulse + theme transition (if dark mode)
      const animations = [
        // Pulse animation
        Animated.sequence([
          Animated.spring(logoScale, {
            toValue: 1.1,
            friction: 3,
            tension: 100,
            useNativeDriver: false, // Can't use native driver with color interpolation
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: false,
          }),
        ]),
      ];

      // If dark mode, also animate the theme transition
      if (isDark) {
        animations.push(
          Animated.timing(themeTransition, {
            toValue: 1,
            duration: 400,
            useNativeDriver: false, // backgroundColor can't use native driver
          })
        );
      }

      Animated.parallel(animations).start();
    };

    startAnimation();
  }, [logoScale, themeTransition, isDark]);

  useEffect(() => {
    if (isReady) {
      // Add a small delay to let user appreciate the animation
      const timer = setTimeout(() => {
        // Animate the splash screen out
        Animated.parallel([
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(logoScale, {
            toValue: 1.5,
            duration: 400,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setShowSplash(false);
        });
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isReady, splashOpacity, logoScale]);

  return (
    <View style={styles.container}>
      {/* Render children behind the splash */}
      <View style={styles.container}>
        {children}
      </View>

      {/* Animated splash overlay - keep in tree to prevent remount */}
      {showSplash && (
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
              { transform: [{ scale: logoScale }] },
            ]}
          >
            {/* Light logo - visible by default, fades out in dark mode */}
            <Animated.Image
              source={require('../../assets/scoot.png')}
              style={[styles.logo, { opacity: lightLogoOpacity }]}
              resizeMode="contain"
            />
            {/* Dark logo - fades in for dark mode */}
            <Animated.Image
              source={require('../../assets/scoot_lite.png')}
              style={[styles.logo, styles.overlayLogo, { opacity: darkLogoOpacity }]}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      )}
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
  overlayLogo: {
    position: 'absolute',
  },
});
