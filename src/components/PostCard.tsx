import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Post, Reaction, Comment } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';
import { CommentsAPI, ReactionsAPI, PostsAPI } from '../api';
import { resolveHandle } from '../lib/resolveHandle';
import { useCurrentUser, isOwner } from '../hooks/useCurrentUser';
import { GlassCard } from './ui/GlassCard';
import { palette } from '../theme/colors';

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
      style={styles.cardTouchable}
      activeOpacity={onPress ? 0.85 : 1}
    >
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            disabled={!onPressAuthor}
            onPress={onPressAuthor}
            style={styles.author}
            activeOpacity={onPressAuthor ? 0.7 : 1}
          >
            <Avatar avatarKey={localPost.avatarKey} size={36} />
            <Text style={styles.handle}>{displayHandle}</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <Text style={styles.timestamp}>
              {new Date(localPost.createdAt).toLocaleString()}
            </Text>
            {userOwnsPost && (
              <TouchableOpacity onPress={handleOptionsPress} style={styles.optionsButton}>
                <Text style={styles.optionsIcon}>⋯</Text>
              </TouchableOpacity>
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
                  reaction.userReacted && styles.reactionButtonActive,
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
              <Text style={styles.viewMoreComments}>View more comments</Text>
            )}
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardTouchable: {
    width: '100%',
  },
  card: {
    width: '100%',
  },
  cardContent: {
    padding: 22,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 16,
  },
  handle: {
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 12,
    flexShrink: 1,
    color: palette.textPrimary,
  },
  timestamp: {
    color: palette.textMuted,
    fontSize: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: palette.textPrimary,
  },
  image: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  imageFallback: {
    aspectRatio: 1,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.25)',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  commentPreviewContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
    paddingTop: 12,
    gap: 10,
  },
  commentPreviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commentPreviewHandle: {
    fontWeight: '600',
    color: palette.textSecondary,
  },
  commentPreviewText: {
    flex: 1,
    color: palette.textPrimary,
  },
  viewMoreComments: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  quickReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  quickReactionButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  quickReactionEmoji: {
    fontSize: 22,
  },
  commentBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(148,163,184,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  commentCount: {
    fontSize: 13,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  optionsButton: {
    padding: 4,
    marginLeft: 4,
  },
  optionsIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.textMuted,
  },
});
