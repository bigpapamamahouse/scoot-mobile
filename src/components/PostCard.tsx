import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Post, Reaction, Comment } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';
import { CommentsAPI, ReactionsAPI } from '../api';
import { resolveHandle } from '../lib/resolveHandle';

export default function PostCard({
  post,
  onPress,
  onPressAuthor,
  showCommentPreview = true,
}: {
  post: Post;
  onPress?: () => void;
  onPressAuthor?: () => void;
  showCommentPreview?: boolean;
}) {
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [commentCount, setCommentCount] = React.useState(
    post.commentCount ?? post.comments?.length ?? 0
  );
  const [previewComments, setPreviewComments] = React.useState<Comment[]>(
    () => (post.comments || []).slice(0, 3)
  );

  React.useEffect(() => {
    setCommentCount(post.commentCount ?? post.comments?.length ?? 0);
    if (post.comments) {
      setPreviewComments(post.comments.slice(0, 3));
    }
  }, [post.commentCount, post.comments]);

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

  React.useEffect(() => {
    if (!showCommentPreview) {
      setPreviewComments([]);
      return;
    }
    if (post.comments && post.comments.length) {
      return;
    }

    let cancelled = false;

    CommentsAPI.listComments(post.id)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const dataArray: Comment[] = Array.isArray(result)
          ? result
          : result?.comments || result?.items || [];
        const preview = dataArray.slice(0, 3);
        setPreviewComments(preview);
        const totalCount: number =
          typeof result?.count === 'number'
            ? result.count
            : typeof result?.total === 'number'
            ? result.total
            : dataArray.length;
        setCommentCount((prev) => Math.max(prev, totalCount));
      })
      .catch((err) => {
        console.warn('Failed to load preview comments for post', post.id, err);
      });

    return () => {
      cancelled = true;
    };
  }, [post.comments, post.id, showCommentPreview]);

  const renderCommentPreview = React.useCallback(
    (comment: Comment) => {
      const handle = resolveHandle(comment);
      const fallbackId =
        typeof comment.userId === 'string' && comment.userId.trim()
          ? `@${comment.userId.trim().slice(0, 8)}`
          : 'Anonymous';
      const displayHandle = handle ? `@${handle}` : fallbackId;
      return (
        <View key={comment.id} style={styles.commentPreviewRow}>
          <Text style={styles.commentPreviewHandle}>{displayHandle}</Text>
          <Text style={styles.commentPreviewText}>{comment.text}</Text>
        </View>
      );
    },
    []
  );

  const postHandle = resolveHandle(post);
  const displayHandle = postHandle ? `@${postHandle}` : `@${post.userId.slice(0, 8)}`;
  const hasMoreComments = commentCount > previewComments.length;

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
          <Text style={styles.handle}>{displayHandle}</Text>
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

      {showCommentPreview && previewComments.length > 0 && (
        <View style={styles.commentPreviewContainer}>
          {previewComments.map(renderCommentPreview)}
          {hasMoreComments && (
            <Text style={styles.viewMoreComments}>view more comments</Text>
          )}
        </View>
      )}
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
  commentPreviewContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
    gap: 6,
  },
  commentPreviewRow: {
    flexDirection: 'row',
    gap: 6,
  },
  commentPreviewHandle: {
    fontWeight: '600',
    color: '#333',
  },
  commentPreviewText: {
    flex: 1,
    color: '#444',
  },
  viewMoreComments: {
    color: '#1d4ed8',
    fontWeight: '500',
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
