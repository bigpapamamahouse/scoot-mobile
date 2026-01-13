/**
 * UploadContext
 * Manages background media uploads with toast notifications
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { ScoopsAPI } from '../api';
import { uploadMedia } from '../lib/upload';
import { ScoopMediaType, ScoopTextOverlay } from '../types';
import { VideoTrimParams } from '../components/ScoopEditor';

export interface UploadTask {
  id: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  message: string;
  error?: string;
}

interface UploadPayload {
  uri: string;
  mediaType: ScoopMediaType;
  aspectRatio: number;
  textOverlays: ScoopTextOverlay[];
  trimParams?: VideoTrimParams;
}

interface UploadContextValue {
  currentUpload: UploadTask | null;
  startUpload: (payload: UploadPayload) => void;
  dismissToast: () => void;
}

const UploadContext = createContext<UploadContextValue>({
  currentUpload: null,
  startUpload: () => {},
  dismissToast: () => {},
});

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentUpload, setCurrentUpload] = useState<UploadTask | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [toastOpacity]);

  const hideToast = useCallback((delay = 0) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentUpload(null);
      });
    }, delay);
  }, [toastOpacity]);

  const dismissToast = useCallback(() => {
    hideToast(0);
  }, [hideToast]);

  const startUpload = useCallback(
    async (payload: UploadPayload) => {
      const uploadId = Date.now().toString();

      // Set initial uploading state
      setCurrentUpload({
        id: uploadId,
        status: 'uploading',
        message: 'Uploading media...',
      });
      showToast();

      try {
        // Step 1: Upload the media
        console.log('[UploadContext] Starting media upload');
        const mediaKey = await uploadMedia({
          uri: payload.uri,
          intent: 'scoop-media',
        });

        if (!mediaKey) {
          throw new Error('Failed to upload media');
        }

        console.log('[UploadContext] Media uploaded, key:', mediaKey);

        // Step 2: Create the scoop (this includes video processing)
        setCurrentUpload({
          id: uploadId,
          status: 'processing',
          message: payload.mediaType === 'video' ? 'Processing video...' : 'Creating scoop...',
        });

        const result = await ScoopsAPI.createScoop({
          mediaKey,
          mediaType: payload.mediaType,
          mediaAspectRatio: payload.aspectRatio,
          textOverlays: payload.textOverlays.length > 0 ? payload.textOverlays : undefined,
          trimParams: payload.trimParams || undefined,
        });

        console.log('[UploadContext] Scoop created:', result);

        // Success!
        setCurrentUpload({
          id: uploadId,
          status: 'success',
          message: 'Scoop shared!',
        });

        // Auto-hide after 3 seconds on success
        hideToast(3000);
      } catch (error: any) {
        console.error('[UploadContext] Upload failed:', error);
        setCurrentUpload({
          id: uploadId,
          status: 'error',
          message: 'Upload failed',
          error: error?.message || 'Unknown error',
        });

        // Auto-hide after 5 seconds on error
        hideToast(5000);
      }
    },
    [showToast, hideToast]
  );

  const contextValue = React.useMemo<UploadContextValue>(
    () => ({
      currentUpload,
      startUpload,
      dismissToast,
    }),
    [currentUpload, startUpload, dismissToast]
  );

  const getToastColors = () => {
    if (!currentUpload) return { bg: colors.neutral[800], text: colors.text.primary };

    switch (currentUpload.status) {
      case 'success':
        return { bg: colors.success[600], text: '#FFFFFF' };
      case 'error':
        return { bg: colors.error[600], text: '#FFFFFF' };
      default:
        return { bg: colors.neutral[800], text: colors.text.primary };
    }
  };

  const toastColors = getToastColors();

  return (
    <UploadContext.Provider value={contextValue}>
      {children}
      {currentUpload && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastOpacity,
              top: insets.top + 10,
              backgroundColor: toastColors.bg,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.toastContent}
            onPress={dismissToast}
            activeOpacity={0.8}
          >
            {(currentUpload.status === 'uploading' || currentUpload.status === 'processing') && (
              <ActivityIndicator size="small" color={toastColors.text} style={styles.spinner} />
            )}
            {currentUpload.status === 'success' && (
              <Text style={[styles.icon, { color: toastColors.text }]}>✓</Text>
            )}
            {currentUpload.status === 'error' && (
              <Text style={[styles.icon, { color: toastColors.text }]}>✕</Text>
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.message, { color: toastColors.text }]}>
                {currentUpload.message}
              </Text>
              {currentUpload.error && (
                <Text style={[styles.errorDetail, { color: toastColors.text }]} numberOfLines={1}>
                  {currentUpload.error}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  spinner: {
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.9,
  },
});
