/**
 * CreateScoopScreen
 * Full-screen experience for creating a new scoop
 * Flow: Camera -> Editor -> Publish (background upload)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScoopCamera } from '../components/ScoopCamera';
import { ScoopEditor } from '../components/ScoopEditor';
import { ScoopMediaType, ScoopTextOverlay } from '../types';
import { VideoTrimParams } from '../components/ScoopEditor';
import { useUpload } from '../contexts/UploadContext';

type EditorState = {
  uri: string;
  type: ScoopMediaType;
  aspectRatio: number;
  isFromGallery: boolean;
  videoDuration?: number; // Duration in seconds for videos
};

export default function CreateScoopScreen({ navigation }: any) {
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const { startUpload } = useUpload();

  const handleCapture = useCallback(
    (uri: string, type: ScoopMediaType, aspectRatio: number, isFromGallery: boolean, videoDuration?: number) => {
      setEditorState({ uri, type, aspectRatio, isFromGallery, videoDuration });
    },
    []
  );

  const handleDiscard = useCallback(() => {
    setEditorState(null);
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handlePublish = useCallback(
    (textOverlays: ScoopTextOverlay[], trimParams?: VideoTrimParams) => {
      if (!editorState) return;

      console.log('[CreateScoopScreen] Starting background upload:', {
        uri: editorState.uri,
        type: editorState.type,
        aspectRatio: editorState.aspectRatio,
        trimParams,
      });

      // Start background upload and navigate back immediately
      startUpload({
        uri: editorState.uri,
        mediaType: editorState.type,
        aspectRatio: editorState.aspectRatio,
        textOverlays,
        trimParams,
      });

      // Navigate back immediately - upload continues in background
      navigation.goBack();
    },
    [editorState, navigation, startUpload]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {editorState ? (
        <ScoopEditor
          mediaUri={editorState.uri}
          mediaType={editorState.type}
          aspectRatio={editorState.aspectRatio}
          videoDuration={editorState.videoDuration}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
          isFromGallery={editorState.isFromGallery}
        />
      ) : (
        <ScoopCamera onCapture={handleCapture} onClose={handleClose} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
