import React from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { User } from '../types';
import { UsersAPI } from '../api';
import { MentionAutocomplete } from './MentionAutocomplete';

interface MentionTextInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Where to position the autocomplete dropdown relative to the input
   * 'above' - appears above the input (useful for inputs at bottom of screen)
   * 'below' - appears below the input (useful for inputs at top of screen)
   * @default 'above'
   */
  placement?: 'above' | 'below';
  /**
   * Maximum height for the autocomplete dropdown in pixels
   * @default 200
   */
  autocompleteMaxHeight?: number;
}

interface MentionState {
  isActive: boolean;
  query: string;
  startIndex: number;
}

export function MentionTextInput({
  value,
  onChangeText,
  style,
  placement = 'above',
  autocompleteMaxHeight = 200,
  ...otherProps
}: MentionTextInputProps) {
  const [mentionState, setMentionState] = React.useState<MentionState>({
    isActive: false,
    query: '',
    startIndex: -1,
  });
  const [suggestedUsers, setSuggestedUsers] = React.useState<User[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const [selectionStart, setSelectionStart] = React.useState(0);

  // Debounce timer for API calls
  const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleTextChange = (text: string) => {
    onChangeText(text);

    // Find the last @ before cursor position
    const beforeCursor = text.substring(0, selectionStart);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      // No @ found, clear mention state
      setMentionState({ isActive: false, query: '', startIndex: -1 });
      setSuggestedUsers([]);
      return;
    }

    // Extract text after the last @
    const afterAt = text.substring(lastAtIndex + 1, selectionStart);

    // Check if there's a space after @, which would end the mention
    if (afterAt.includes(' ')) {
      setMentionState({ isActive: false, query: '', startIndex: -1 });
      setSuggestedUsers([]);
      return;
    }

    // Update mention state
    setMentionState({
      isActive: afterAt.length >= 2, // Only activate after 2 characters
      query: afterAt,
      startIndex: lastAtIndex,
    });

    // Fetch suggestions if we have at least 2 characters
    if (afterAt.length >= 2) {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new debounced API call
      debounceTimer.current = setTimeout(async () => {
        setLoadingSuggestions(true);
        try {
          const users = await UsersAPI.searchFollowingForMentions(afterAt);
          setSuggestedUsers(users);
        } catch (error) {
          console.error('Error fetching mention suggestions:', error);
          setSuggestedUsers([]);
        } finally {
          setLoadingSuggestions(false);
        }
      }, 300); // 300ms debounce
    } else {
      setSuggestedUsers([]);
    }
  };

  const handleSelectUser = (user: User) => {
    if (!mentionState.isActive || !user.handle) return;

    // Replace the @query with @handle
    const beforeMention = value.substring(0, mentionState.startIndex);
    const afterMention = value.substring(selectionStart);
    const newText = `${beforeMention}@${user.handle} ${afterMention}`;

    onChangeText(newText);

    // Clear mention state
    setMentionState({ isActive: false, query: '', startIndex: -1 });
    setSuggestedUsers([]);

    // Update cursor position
    const newCursorPos = mentionState.startIndex + user.handle.length + 2; // +2 for @ and space
    setSelectionStart(newCursorPos);
  };

  const handleSelectionChange = (event: any) => {
    const start = event.nativeEvent.selection.start;
    setSelectionStart(start);
  };

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const autocompleteContainerStyle = React.useMemo(() => {
    return placement === 'above'
      ? styles.autocompleteAbove
      : styles.autocompleteBelow;
  }, [placement]);

  return (
    <View style={styles.container}>
      {placement === 'above' && mentionState.isActive && suggestedUsers.length > 0 && (
        <View style={autocompleteContainerStyle}>
          <MentionAutocomplete
            users={suggestedUsers}
            loading={loadingSuggestions}
            onSelectUser={handleSelectUser}
            maxHeight={autocompleteMaxHeight}
          />
        </View>
      )}
      <TextInput
        {...otherProps}
        style={style}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
      />
      {placement === 'below' && mentionState.isActive && suggestedUsers.length > 0 && (
        <View style={styles.autocompleteInline}>
          <MentionAutocomplete
            users={suggestedUsers}
            loading={loadingSuggestions}
            onSelectUser={handleSelectUser}
            maxHeight={autocompleteMaxHeight}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  autocompleteAbove: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 12,
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  autocompleteBelow: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  autocompleteInline: {
    marginTop: 2,
  },
});
