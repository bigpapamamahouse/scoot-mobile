/**
 * UploadContext
 * Manages background media uploads with status tracking
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
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
  isUploading: boolean;
  startUpload: (payload: UploadPayload) => void;
  onUploadSuccess: (callback: () => void) => () => void;
}

const UploadContext = createContext<UploadContextValue>({
  currentUpload: null,
  isUploading: false,
  startUpload: () => {},
  onUploadSuccess: () => () => {},
});

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [currentUpload, setCurrentUpload] = useState<UploadTask | null>(null);
  const successCallbacksRef = useRef<Set<() => void>>(new Set());

  // Subscribe to upload success events
  const onUploadSuccess = useCallback((callback: () => void) => {
    successCallbacksRef.current.add(callback);
    return () => {
      successCallbacksRef.current.delete(callback);
    };
  }, []);

  const startUpload = useCallback(
    async (payload: UploadPayload) => {
      const uploadId = Date.now().toString();

      // Set initial uploading state
      setCurrentUpload({
        id: uploadId,
        status: 'uploading',
        message: 'Uploading media...',
      });

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

        // Notify all subscribers
        successCallbacksRef.current.forEach((cb) => cb());

        // Clear status after a short delay
        setTimeout(() => {
          setCurrentUpload(null);
        }, 1500);
      } catch (error: any) {
        console.error('[UploadContext] Upload failed:', error);
        setCurrentUpload({
          id: uploadId,
          status: 'error',
          message: 'Upload failed',
          error: error?.message || 'Unknown error',
        });

        // Clear error status after 5 seconds
        setTimeout(() => {
          setCurrentUpload(null);
        }, 5000);
      }
    },
    []
  );

  const isUploading = currentUpload?.status === 'uploading' || currentUpload?.status === 'processing';

  const contextValue = React.useMemo<UploadContextValue>(
    () => ({
      currentUpload,
      isUploading,
      startUpload,
      onUploadSuccess,
    }),
    [currentUpload, isUploading, startUpload, onUploadSuccess]
  );

  return (
    <UploadContext.Provider value={contextValue}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}
