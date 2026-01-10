/**
 * ScoopEditor Component
 * Editor for adding text overlays to captured media
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  ScrollView,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '../theme';
import { ScoopMediaType, ScoopTextOverlay, ScoopFontFamily } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScoopEditorProps {
  mediaUri: string;
  mediaType: ScoopMediaType;
  aspectRatio: number;
  onPublish: (textOverlays: ScoopTextOverlay[]) => void;
  onDiscard: () => void;
}

interface TextOverlayState extends Omit<ScoopTextOverlay, 'id'> {
  id: string;
  pan: Animated.ValueXY;
}

const FONT_OPTIONS: { id: ScoopFontFamily; label: string }[] = [
  { id: 'default', label: 'Aa' },
  { id: 'bold', label: 'AB' },
  { id: 'script', label: 'Aa' },
  { id: 'mono', label: '</>' },
];

const COLOR_OPTIONS = [
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
];

const getFontStyle = (fontFamily: ScoopFontFamily) => {
  switch (fontFamily) {
    case 'bold':
      return { fontWeight: '800' as const };
    case 'script':
      return { fontStyle: 'italic' as const, fontWeight: '500' as const };
    case 'mono':
      return { fontFamily: 'monospace' };
    default:
      return { fontWeight: '600' as const };
  }
};

export const ScoopEditor: React.FC<ScoopEditorProps> = ({
  mediaUri,
  mediaType,
  aspectRatio,
  onPublish,
  onDiscard,
}) => {
  const { colors } = useTheme();
  const [textOverlays, setTextOverlays] = useState<TextOverlayState[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [selectedFont, setSelectedFont] = useState<ScoopFontFamily>('default');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);

  const isVideo = mediaType === 'video';

  // Create video player for preview
  const player = useVideoPlayer(isVideo ? mediaUri : null, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const addTextOverlay = useCallback(() => {
    if (!currentText.trim()) {
      setIsAddingText(false);
      return;
    }

    const newOverlay: TextOverlayState = {
      id: `overlay-${Date.now()}`,
      text: currentText.trim(),
      x: 50, // Center
      y: 50, // Center
      fontFamily: selectedFont,
      fontSize: 24,
      color: selectedColor,
      backgroundColor: selectedColor === '#FFFFFF' ? 'rgba(0,0,0,0.5)' : undefined,
      pan: new Animated.ValueXY({ x: SCREEN_WIDTH / 2 - 50, y: SCREEN_HEIGHT / 2 - 20 }),
    };

    setTextOverlays((prev) => [...prev, newOverlay]);
    setCurrentText('');
    setIsAddingText(false);
  }, [currentText, selectedFont, selectedColor]);

  const removeOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId(null);
  }, []);

  const handlePublish = useCallback(() => {
    // Convert overlay states to final format with percentage positions
    const finalOverlays: ScoopTextOverlay[] = textOverlays.map((overlay) => {
      // Get final position from animated value
      const x = (overlay.pan.x as any)._value || 0;
      const y = (overlay.pan.y as any)._value || 0;

      return {
        id: overlay.id,
        text: overlay.text,
        x: (x / SCREEN_WIDTH) * 100,
        y: (y / SCREEN_HEIGHT) * 100,
        fontFamily: overlay.fontFamily,
        fontSize: overlay.fontSize,
        color: overlay.color,
        backgroundColor: overlay.backgroundColor,
      };
    });

    onPublish(finalOverlays);
  }, [textOverlays, onPublish]);

  const createPanResponder = useCallback(
    (overlay: TextOverlayState) => {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setSelectedOverlayId(overlay.id);
          overlay.pan.setOffset({
            x: (overlay.pan.x as any)._value,
            y: (overlay.pan.y as any)._value,
          });
          overlay.pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
          [null, { dx: overlay.pan.x, dy: overlay.pan.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: () => {
          overlay.pan.flattenOffset();
        },
      });
    },
    []
  );

  const startAddingText = useCallback(() => {
    setIsAddingText(true);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  return (
    <View style={styles.container}>
      {/* Media preview */}
      <View style={styles.mediaContainer}>
        {isVideo && player ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: mediaUri }}
            style={styles.media}
            resizeMode="cover"
          />
        )}

        {/* Text overlays */}
        {textOverlays.map((overlay) => {
          const panResponder = createPanResponder(overlay);
          return (
            <Animated.View
              key={overlay.id}
              style={[
                styles.textOverlay,
                {
                  transform: overlay.pan.getTranslateTransform(),
                },
                selectedOverlayId === overlay.id && styles.selectedOverlay,
              ]}
              {...panResponder.panHandlers}
            >
              <Text
                style={[
                  styles.overlayText,
                  getFontStyle(overlay.fontFamily),
                  {
                    fontSize: overlay.fontSize,
                    color: overlay.color,
                    backgroundColor: overlay.backgroundColor || 'transparent',
                  },
                ]}
              >
                {overlay.text}
              </Text>
              {selectedOverlayId === overlay.id && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeOverlay(overlay.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* Top controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.controlButton} onPress={onDiscard}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={startAddingText}>
          <Ionicons name="text" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.publishButton}
          onPress={handlePublish}
        >
          <Text style={styles.publishText}>Share Scoop</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Text input overlay */}
      {isAddingText && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.textInputOverlay}
        >
          <TouchableOpacity
            style={styles.textInputBackground}
            activeOpacity={1}
            onPress={() => addTextOverlay()}
          />

          <View style={styles.textInputContainer}>
            {/* Font options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fontOptions}
              contentContainerStyle={styles.fontOptionsContent}
            >
              {FONT_OPTIONS.map((font) => (
                <TouchableOpacity
                  key={font.id}
                  style={[
                    styles.fontOption,
                    selectedFont === font.id && styles.fontOptionSelected,
                  ]}
                  onPress={() => setSelectedFont(font.id)}
                >
                  <Text
                    style={[
                      styles.fontOptionText,
                      getFontStyle(font.id),
                      selectedFont === font.id && styles.fontOptionTextSelected,
                    ]}
                  >
                    {font.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorOptions}
              contentContainerStyle={styles.colorOptionsContent}
            >
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </ScrollView>

            {/* Text input */}
            <View style={styles.inputRow}>
              <TextInput
                ref={textInputRef}
                style={[
                  styles.textInput,
                  getFontStyle(selectedFont),
                  { color: selectedColor },
                ]}
                value={currentText}
                onChangeText={setCurrentText}
                placeholder="Type something..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                maxLength={100}
                autoFocus
              />
              <TouchableOpacity
                style={styles.doneButton}
                onPress={addTextOverlay}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 25,
    gap: spacing[2],
  },
  publishText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  textOverlay: {
    position: 'absolute',
    maxWidth: '80%',
  },
  selectedOverlay: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  overlayText: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    right: -12,
  },
  textInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  textInputBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  textInputContainer: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingBottom: spacing[6],
  },
  fontOptions: {
    maxHeight: 50,
    marginTop: spacing[3],
  },
  fontOptionsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  fontOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: spacing[2],
  },
  fontOptionSelected: {
    backgroundColor: '#007AFF',
  },
  fontOptionText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
  },
  fontOptionTextSelected: {
    color: '#fff',
  },
  colorOptions: {
    maxHeight: 50,
    marginTop: spacing[3],
  },
  colorOptionsContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    alignItems: 'center',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: spacing[2],
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginTop: spacing[3],
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    maxHeight: 100,
  },
  doneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
  },
});

export default ScoopEditor;
