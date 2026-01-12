/**
 * CreateScoopScreen
 * Full-screen experience for creating a new scoop
 * Flow: Camera -> Editor -> Publish
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScoopCamera } from '../components/ScoopCamera';
import { ScoopEditor } from '../components/ScoopEditor';
import { ScoopsAPI } from '../api';
import { uploadMedia } from '../lib/upload';
import { ScoopMediaType, ScoopTextOverlay } from '../types';
import { useTheme } from '../theme';

type EditorState = {
  uri: string;
  type: ScoopMediaType;
  aspectRatio: number;
};

export default function CreateScoopScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleCapture = useCallback(
    (uri: string, type: ScoopMediaType, aspectRatio: number) => {
      setEditorState({ uri, type, aspectRatio });
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
    async (textOverlays: ScoopTextOverlay[]) => {
      if (!editorState) return;

      setIsPublishing(true);

      try {
        // Upload the media
        console.log('[CreateScoopScreen] Uploading media:', {
          uri: editorState.uri,
          type: editorState.type,
          aspectRatio: editorState.aspectRatio,
        });

        const mediaKey = await uploadMedia({
          uri: editorState.uri,
          intent: 'scoop-media',
        });

        console.log('[CreateScoopScreen] Media uploaded, key:', mediaKey);

        if (!mediaKey) {
          throw new Error('Failed to upload media');
        }

        // Create the scoop
        console.log('[CreateScoopScreen] Creating scoop with:', {
          mediaKey,
          mediaType: editorState.type,
          mediaAspectRatio: editorState.aspectRatio,
        });

        const result = await ScoopsAPI.createScoop({
          mediaKey,
          mediaType: editorState.type,
          mediaAspectRatio: editorState.aspectRatio,
          textOverlays: textOverlays.length > 0 ? textOverlays : undefined,
        });

        console.log('[CreateScoopScreen] Scoop created:', result);

        Alert.alert('Success', 'Your scoop has been shared!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } catch (error: any) {
        console.error('[CreateScoopScreen] Failed to publish scoop:', error);
        Alert.alert('Error', error?.message || 'Failed to share your scoop');
      } finally {
        setIsPublishing(false);
      }
    },
    [editorState, navigation]
  );

  if (isPublishing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {editorState ? (
        <ScoopEditor
          mediaUri={editorState.uri}
          mediaType={editorState.type}
          aspectRatio={editorState.aspectRatio}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
