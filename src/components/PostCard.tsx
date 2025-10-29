import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Post, Reaction } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';
import { ReactionsAPI } from '../api';

export default function PostCard({
  post,
  onPress,
  onPressAuthor,
}: {
  post: Post;
  onPress?: () => void;
  onPressAuthor?: () => void;
}) {
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [commentCount, setCommentCount] = React.useState(post.commentCount || 0);

  React.useEffect(() => {
    setCommentCount(post.commentCount || 0);
  }, [post.commentCount]);

  // Load reactions
  React.useEffect(() => {
    ReactionsAPI.getReactions(post.id)
      .then((data) => {
        console.log('Reactions data for post', post.id, ':', data);
        // Handle both array directly or nested in object
        const reactionsData = Array.isArray(data) ? data : (data.reactions || data.items || []);
        setReactions(reactionsData);
      })
      .catch((e) => {
        console.warn('Failed to load reactions for post', post.id, ':', e);
      });
  }, [post.id]);

  const handleReaction = async (emoji: string) => {
    try {
      console.log('Toggling reaction', emoji, 'for post', post.id);
      const response = await ReactionsAPI.toggleReaction(post.id, emoji);
      console.log('Toggle reaction response:', response);

      // Reload reactions
      const data = await ReactionsAPI.getReactions(post.id);
      const reactionsData = Array.isArray(data) ? data : (data.reactions || data.items || []);
      setReactions(reactionsData);
    } catch (e: any) {
      console.error('Failed to toggle reaction:', e);
      console.error('Error details:', e?.message, e?.response);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.card}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          disabled={!onPressAuthor}
          onPress={onPressAuthor}
          style={styles.author}
          activeOpacity={onPressAuthor ? 0.7 : 1}
        >
          <Avatar avatarKey={post.avatarKey} size={32} />
          <Text style={styles.handle}>@{post.handle || post.userId.slice(0, 8)}</Text>
        </TouchableOpacity>
        <Text style={styles.timestamp}>
          {new Date(post.createdAt).toLocaleString()}
        </Text>
      </View>

      {/* Content */}
      <Text style={styles.text}>{post.text}</Text>

      {/* Image */}
      {post.imageKey && (
        <Image
          source={{ uri: mediaUrlFromKey(post.imageKey)! }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Reactions */}
      {reactions.length > 0 && (
        <View style={styles.reactions}>
          {reactions.map((reaction) => (
            <TouchableOpacity
              key={reaction.emoji}
              onPress={() => handleReaction(reaction.emoji)}
              style={[
                styles.reactionButton,
                reaction.userReacted && styles.reactionButtonActive
              ]}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Quick Reactions */}
      <View style={styles.quickReactions}>
        {['❤️', '👍', '😂', '🎉'].map((emoji) => (
          <TouchableOpacity
            key={emoji}
            onPress={() => handleReaction(emoji)}
            style={styles.quickReactionButton}
          >
            <Text style={styles.quickReactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}

        {commentCount > 0 && (
          <View style={styles.commentBadge}>
            <Text style={styles.commentCount}>💬 {commentCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 12,
  },
  handle: {
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
    flexShrink: 1,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  reactionButtonActive: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  quickReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickReactionButton: {
    padding: 4,
  },
  quickReactionEmoji: {
    fontSize: 18,
  },
  commentBadge: {
    marginLeft: 'auto',
  },
  commentCount: {
    fontSize: 13,
    color: '#666',
  },
});
