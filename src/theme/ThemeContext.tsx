/**
 * Theme Context for Dark Mode Support
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ColorPalette } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ColorPalette;
  effectiveMode: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Determine effective mode based on setting
  const effectiveMode: 'light' | 'dark' =
    mode === 'system'
      ? (systemColorScheme === 'dark' ? 'dark' : 'light')
      : mode;

  // Load theme preference from storage on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
        setMode(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    saveThemePreference(newMode);
  };

  const toggleTheme = () => {
    // Toggle between light, dark, and system
    const newMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setTheme(newMode);
  };

  const colors = effectiveMode === 'dark' ? darkColors : lightColors;

  const value: ThemeContextType = {
    mode,
    colors,
    effectiveMode,
    toggleTheme,
    setTheme,
  };

  // Don't render children until theme is loaded
  if (isLoading) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
