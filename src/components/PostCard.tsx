import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post, Reaction, Comment } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';
import { CommentsAPI, ReactionsAPI, PostsAPI } from '../api';
import { resolveHandle } from '../lib/resolveHandle';
import { useCurrentUser, isOwner } from '../hooks/useCurrentUser';
import { IconButton, Badge } from './ui';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function PostCard({
  post,
  onPress,
  onPressAuthor,
  showCommentPreview = true,
  onPostUpdated,
  onPostDeleted,
}: {
  post: Post;
  onPress?: () => void;
  onPressAuthor?: () => void;
  showCommentPreview?: boolean;
  onPostUpdated?: (updatedPost: Post) => void;
  onPostDeleted?: (postId: string) => void;
}) {
  const { currentUser } = useCurrentUser();
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [commentCount, setCommentCount] = React.useState(
    post.commentCount ?? post.comments?.length ?? 0
  );
  const [previewComments, setPreviewComments] = React.useState<Comment[]>(
    () => (post.comments || []).slice(0, 3)
  );
  const [imageAspectRatio, setImageAspectRatio] = React.useState<number | null>(null);
  const [localPost, setLocalPost] = React.useState<Post>(post);

  const imageUri = React.useMemo(() => mediaUrlFromKey(localPost.imageKey), [localPost.imageKey]);

  // Update local post when prop changes
  React.useEffect(() => {
    setLocalPost(post);
  }, [post]);

  const userOwnsPost = React.useMemo(() => {
    return isOwner(localPost, currentUser);
  }, [localPost, currentUser]);

  const handleEdit = () => {
    Alert.prompt(
      'Edit Post',
      'Update your post text:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text) => {
            if (!text || !text.trim()) {
              Alert.alert('Error', 'Post text cannot be empty');
              return;
            }
            try {
              await PostsAPI.updatePost(localPost.id, text.trim());
              const updatedPost = { ...localPost, text: text.trim() };
              setLocalPost(updatedPost);
              onPostUpdated?.(updatedPost);
              Alert.alert('Success', 'Post updated successfully');
            } catch (error) {
              console.error('Failed to update post:', error);
              Alert.alert('Error', 'Failed to update post. Please try again.');
            }
          },
        },
      ],
      'plain-text',
      localPost.text
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PostsAPI.deletePost(localPost.id);
              onPostDeleted?.(localPost.id);
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Failed to delete post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleOptionsPress = () => {
    Alert.alert('Post Options', 'Choose an action:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: handleEdit },
      { text: 'Delete', onPress: handleDelete, style: 'destructive' },
    ]);
  };

  React.useEffect(() => {
    if (!imageUri) {
      setImageAspectRatio(null);
      return;
    }

    let cancelled = false;

    Image.getSize(
      imageUri,
      (width, height) => {
        if (cancelled) {
          return;
        }
        if (width > 0 && height > 0) {
          setImageAspectRatio(width / height);
        } else {
          setImageAspectRatio(null);
        }
      },
      (error) => {
        if (cancelled) {
          return;
        }
        console.warn('Failed to get image dimensions for', imageUri, error);
        setImageAspectRatio(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [imageUri]);

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

  const postHandle = resolveHandle(localPost);
  const displayHandle = postHandle ? `@${postHandle}` : `@${localPost.userId.slice(0, 8)}`;
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
          <Avatar avatarKey={localPost.avatarKey} size={32} />
          <Text style={styles.handle}>{displayHandle}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.timestamp}>
            {new Date(localPost.createdAt).toLocaleString()}
          </Text>
          {userOwnsPost && (
            <IconButton
              icon="ellipsis-horizontal"
              onPress={handleOptionsPress}
              variant="ghost"
              size="sm"
              color={colors.text.secondary}
            />
          )}
        </View>
      </View>

      {/* Content */}
      <Text style={styles.text}>{localPost.text}</Text>

      {/* Image */}
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            imageAspectRatio
              ? { aspectRatio: imageAspectRatio }
              : styles.imageFallback,
          ]}
          resizeMode="contain"
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
        <IconButton
          icon="heart-outline"
          onPress={() => handleReaction('❤️')}
          variant="ghost"
          size="sm"
          color={colors.social.like}
        />
        <IconButton
          icon="thumbs-up-outline"
          onPress={() => handleReaction('👍')}
          variant="ghost"
          size="sm"
          color={colors.primary[500]}
        />
        <IconButton
          icon="happy-outline"
          onPress={() => handleReaction('😂')}
          variant="ghost"
          size="sm"
          color={colors.social.laugh}
        />
        <IconButton
          icon="sparkles-outline"
          onPress={() => handleReaction('🎉')}
          variant="ghost"
          size="sm"
          color={colors.social.celebrate}
        />

        {commentCount > 0 && (
          <View style={styles.commentBadge}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.commentCount}>{commentCount}</Text>
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
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    ...shadows.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: spacing[3],
  },
  handle: {
    ...typography.styles.label,
    marginLeft: spacing[2],
    flexShrink: 1,
    color: colors.text.primary,
  },
  timestamp: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
  text: {
    ...typography.styles.body,
    marginBottom: spacing[2],
    color: colors.text.primary,
  },
  image: {
    width: '100%',
    borderRadius: borderRadius.base,
    marginBottom: spacing[2],
    backgroundColor: colors.neutral[100],
  },
  imageFallback: {
    aspectRatio: 1,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    gap: spacing[1],
  },
  reactionButtonActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  reactionEmoji: {
    fontSize: typography.fontSize.sm,
  },
  reactionCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  commentPreviewContainer: {
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  commentPreviewRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  commentPreviewHandle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
  },
  commentPreviewText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  viewMoreComments: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  quickReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  commentBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  commentCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
});
