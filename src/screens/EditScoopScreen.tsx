import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../theme';
import { uploadMedia, guessMediaContentType } from '../lib/upload';
import { createScoop } from '../api/scoops';
import { TextOverlay } from '../types';

const { width, height } = Dimensions.get('window');

const FONTS = [
  { name: 'System', value: 'system', weight: 'normal' as const },
  { name: 'Bold', value: 'system-bold', weight: 'bold' as const },
  { name: 'Monospace', value: 'monospace', weight: 'normal' as const },
];

const COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#FF3B30', // Red
  '#007AFF', // Blue
  '#34C759', // Green
  '#FFCC00', // Yellow
  '#FF9500', // Orange
  '#AF52DE', // Purple
];

export default function EditScoopScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { mediaUri, mediaType, aspectRatio, duration } = route.params;

  const [textOverlays, setTextOverlays] = React.useState<TextOverlay[]>([]);
  const [isAddingText, setIsAddingText] = React.useState(false);
  const [currentText, setCurrentText] = React.useState('');
  const [selectedFont, setSelectedFont] = React.useState(FONTS[0].value);
  const [selectedColor, setSelectedColor] = React.useState(COLORS[0]);
  const [isPosting, setIsPosting] = React.useState(false);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const addTextOverlay = () => {
    if (!currentText.trim()) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    const newOverlay: TextOverlay = {
      text: currentText,
      font: selectedFont,
      color: selectedColor,
      position: { x: 0.5, y: 0.5 }, // Center position (relative to container)
    };

    setTextOverlays([...textOverlays, newOverlay]);
    setCurrentText('');
    setIsAddingText(false);
  };

  const removeTextOverlay = (index: number) => {
    setTextOverlays(textOverlays.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    setIsPosting(true);
    try {
      // Upload media
      const contentType = guessMediaContentType(mediaUri, mediaType === 'video' ? 'video' : 'image');
      const key = await uploadMedia({
        uri: mediaUri,
        contentType,
        intent: 'scoop-media',
      });

      if (!key) {
        throw new Error('Upload failed');
      }

      // Create scoop
      await createScoop({
        mediaKey: key,
        mediaType,
        duration,
        aspectRatio,
        textOverlay: textOverlays.length > 0 ? textOverlays : undefined,
      });

      // Navigate back to feed
      navigation.navigate('Feed');
      Alert.alert('Success', 'Scoop posted!');
    } catch (error: any) {
      console.error('Error posting scoop:', error);
      Alert.alert('Error', error.message || 'Failed to post scoop');
    } finally {
      setIsPosting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Scoop?',
      'Are you sure you want to discard this scoop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} disabled={isPosting}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Scoop</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isPosting}
          style={styles.postButton}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={styles.previewContainer}>
        {mediaType === 'video' ? (
          <Video
            source={{ uri: mediaUri }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted
          />
        ) : (
          <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
        )}

        {/* Text overlays */}
        {textOverlays.map((overlay, index) => (
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
            <TouchableOpacity
              style={styles.removeOverlayButton}
              onPress={() => removeTextOverlay(index)}
            >
              <Ionicons name="close-circle" size={24} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.addTextButton}
          onPress={() => setIsAddingText(true)}
        >
          <Ionicons name="text" size={24} color={colors.primary} />
          <Text style={styles.addTextButtonText}>Add Text</Text>
        </TouchableOpacity>

        {textOverlays.length > 0 && (
          <Text style={styles.overlayCount}>
            {textOverlays.length} text overlay{textOverlays.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Add Text Modal */}
      <Modal
        visible={isAddingText}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddingText(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Text</Text>
              <TouchableOpacity onPress={() => setIsAddingText(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor={colors.textSecondary}
              value={currentText}
              onChangeText={setCurrentText}
              multiline
              maxLength={100}
              autoFocus
            />

            {/* Font selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Font</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FONTS.map((font) => (
                  <TouchableOpacity
                    key={font.value}
                    style={[
                      styles.fontOption,
                      selectedFont === font.value && styles.fontOptionSelected,
                    ]}
                    onPress={() => setSelectedFont(font.value)}
                  >
                    <Text
                      style={[
                        styles.fontOptionText,
                        {
                          fontFamily: font.value.includes('monospace') ? 'monospace' : undefined,
                          fontWeight: font.weight,
                        },
                        selectedFont === font.value && styles.fontOptionTextSelected,
                      ]}
                    >
                      {font.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Color selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Color</Text>
              <View style={styles.colorGrid}>
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={color === '#FFFFFF' ? '#000000' : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preview */}
            <View style={styles.textPreviewContainer}>
              <Text
                style={[
                  styles.textPreview,
                  {
                    fontFamily: selectedFont.includes('monospace') ? 'monospace' : undefined,
                    color: selectedColor,
                    fontWeight: selectedFont === 'system-bold' ? '700' : 'normal',
                  },
                ]}
              >
                {currentText || 'Preview'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={addTextOverlay}
              disabled={!currentText.trim()}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    postButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    postButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    media: {
      width: '100%',
      height: '100%',
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
    removeOverlayButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: 'white',
      borderRadius: 12,
    },
    controls: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
      gap: 8,
    },
    addTextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primaryBackground,
      borderRadius: 8,
    },
    addTextButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    overlayCount: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    textInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      minHeight: 80,
      maxHeight: 120,
      marginBottom: 16,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    fontOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    fontOptionSelected: {
      borderColor: colors.primary,
    },
    fontOptionText: {
      fontSize: 16,
      color: colors.text,
    },
    fontOptionTextSelected: {
      color: colors.primary,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    colorOption: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: colors.primary,
    },
    textPreviewContainer: {
      backgroundColor: '#000',
      padding: 20,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 16,
    },
    textPreview: {
      fontSize: 24,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });
