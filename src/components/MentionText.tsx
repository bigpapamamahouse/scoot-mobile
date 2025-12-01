import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../theme';

interface MentionTextProps {
  text: string;
  style?: TextStyle;
  onPressMention?: (handle: string) => void;
}

interface TextPart {
  text: string;
  isMention: boolean;
  handle?: string;
}

/**
 * Component that renders text with clickable @mentions
 * Parses text for @handle patterns and makes them tappable
 */
export function MentionText({ text, style, onPressMention }: MentionTextProps) {
  const { colors } = useTheme();

  const parseMentions = (inputText: string): TextPart[] => {
    const parts: TextPart[] = [];

    // Regex to match @handle (letters, numbers, underscores, hyphens)
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(inputText)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({
          text: inputText.substring(lastIndex, match.index),
          isMention: false,
        });
      }

      // Add the mention
      parts.push({
        text: match[0], // Full match including @
        isMention: true,
        handle: match[1], // Just the handle without @
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last mention
    if (lastIndex < inputText.length) {
      parts.push({
        text: inputText.substring(lastIndex),
        isMention: false,
      });
    }

    return parts;
  };

  const parts = React.useMemo(() => parseMentions(text), [text]);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.isMention && part.handle) {
          return (
            <Text
              key={index}
              style={{
                color: colors.primary[500],
                fontWeight: '600',
              }}
              onPress={() => onPressMention?.(part.handle!)}
            >
              {part.text}
            </Text>
          );
        }
        return <Text key={index}>{part.text}</Text>;
      })}
    </Text>
  );
}
