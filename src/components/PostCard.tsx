import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post, Reaction, ReactionWithUsers, Comment } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { Avatar } from './Avatar';
import { CommentsAPI, ReactionsAPI, PostsAPI } from '../api';
import { resolveHandle } from '../lib/resolveHandle';
import { useCurrentUser, isOwner } from '../hooks/useCurrentUser';
import { IconButton, Badge } from './ui';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';
import { ReactionDetailsModal } from './ReactionDetailsModal';

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
  const { colors } = useTheme();
  const { currentUser } = useCurrentUser();
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [detailedReactions, setDetailedReactions] = React.useState<ReactionWithUsers[]>([]);
  const [showReactionModal, setShowReactionModal] = React.useState(false);
  const [loadingReactionDetails, setLoadingReactionDetails] = React.useState(false);
  const [commentCount, setCommentCount] = React.useState(
    post.commentCount ?? post.comments?.length ?? 0
  );
  const [previewComments, setPreviewComments] = React.useState<Comment[]>(
    () => (post.comments || []).slice(0, 3)
  );
  const [imageAspectRatio, setImageAspectRatio] = React.useState<number | null>(null);
  const [localPost, setLocalPost] = React.useState<Post>(post);

  const imageUri = React.useMemo(() => mediaUrlFromKey(localPost.imageKey), [localPost.imageKey]);

  // Helper function to parse reactions API response
  const parseReactionsResponse = (data: any): Reaction[] => {
    if (!data || typeof data !== 'object') {
      return [];
    }

    // Handle { counts: { emoji: count }, my: [emoji] } format
    if (data.counts && typeof data.counts === 'object') {
      const myReactions = Array.isArray(data.my) ? data.my : [];

      return Object.entries(data.counts)
        .filter(([emoji, count]) => typeof count === 'number' && count > 0)
        .map(([emoji, count]) => ({
          emoji,
          count: count as number,
          userReacted: myReactions.includes(emoji),
        }));
    }

    // Fallback: handle array format
    if (Array.isArray(data)) {
      return data;
    }

    // Fallback: handle nested format
    if (data.reactions || data.items) {
      return data.reactions || data.items || [];
    }

    return [];
  };

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
        console.log('=== REACTIONS API RESPONSE ===');
        console.log('Post ID:', post.id);
        console.log('Raw data:', JSON.stringify(data, null, 2));

        const reactionsData = parseReactionsResponse(data);

        console.log('Parsed reactions:', JSON.stringify(reactionsData, null, 2));
        console.log('Reactions count:', reactionsData.length);

        setReactions(reactionsData);
      })
      .catch((e) => {
        console.warn('Failed to load reactions for post', post.id, ':', e);
      });
  }, [post.id]);

  const handleReaction = async (emoji: string) => {
    try {
      console.log('=== TOGGLING REACTION ===');
      console.log('Emoji:', emoji);
      console.log('Post ID:', post.id);

      const response = await ReactionsAPI.toggleReaction(post.id, emoji);
      console.log('Toggle response:', JSON.stringify(response, null, 2));

      // Reload reactions
      const data = await ReactionsAPI.getReactions(post.id);
      console.log('Reloaded reactions:', JSON.stringify(data, null, 2));

      const reactionsData = parseReactionsResponse(data);
      console.log('Setting reactions to:', JSON.stringify(reactionsData, null, 2));

      setReactions(reactionsData);
    } catch (e: any) {
      console.error('Failed to toggle reaction:', e);
      console.error('Error details:', e?.message, e?.response);
    }
  };

  const handleShowReactionDetails = async () => {
    setShowReactionModal(true);
    setLoadingReactionDetails(true);

    try {
      const data = await ReactionsAPI.getReactionsWho(post.id);
      console.log('=== DETAILED REACTIONS API RESPONSE ===');
      console.log('Raw data:', JSON.stringify(data, null, 2));

      // Parse response format: { counts: { emoji: count }, my: [emoji], who: { emoji: [users] } }
      let reactionsWithUsers: ReactionWithUsers[] = [];

      if (data && typeof data === 'object') {
        if (data.counts && typeof data.counts === 'object') {
          const myReactions = Array.isArray(data.my) ? data.my : [];
          const whoData = data.who && typeof data.who === 'object' ? data.who : {};

          reactionsWithUsers = Object.entries(data.counts)
            .filter(([emoji, count]) => typeof count === 'number' && count > 0)
            .map(([emoji, count]) => ({
              emoji,
              count: count as number,
              userReacted: myReactions.includes(emoji),
              users: Array.isArray(whoData[emoji]) ? whoData[emoji] : [],
            }));
        } else if (Array.isArray(data)) {
          // Fallback: handle array format
          reactionsWithUsers = data;
        } else if (data.reactions || data.items) {
          // Fallback: handle nested format
          reactionsWithUsers = data.reactions || data.items || [];
        }
      }

      console.log('Parsed detailed reactions:', JSON.stringify(reactionsWithUsers, null, 2));
      setDetailedReactions(reactionsWithUsers);
    } catch (e: any) {
      console.error('Failed to load reaction details:', e);
      Alert.alert('Error', 'Failed to load reaction details');
    } finally {
      setLoadingReactionDetails(false);
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

  // Helper function to get reaction info for a specific emoji
  const getReactionInfo = (emoji: string) => {
    const reaction = reactions.find(r => r.emoji === emoji);
    return {
      hasReacted: reaction?.userReacted || false,
      count: reaction?.count || 0,
    };
  };

  const postHandle = resolveHandle(localPost);
  const displayHandle = postHandle ? `@${postHandle}` : `@${localPost.userId.slice(0, 8)}`;
  const hasMoreComments = commentCount > previewComments.length;

  const styles = React.useMemo(() => createStyles(colors), [colors]);

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

      {/* Reactions Summary - Shows who reacted */}
      {reactions.length > 0 && (
        <TouchableOpacity
          onPress={handleShowReactionDetails}
          style={styles.reactionsSummary}
          activeOpacity={0.7}
        >
          <View style={styles.reactionsSummaryContent}>
            {reactions.map((reaction, index) => (
              <View key={reaction.emoji} style={styles.reactionSummaryItem}>
                <Text style={styles.reactionSummaryEmoji}>{reaction.emoji}</Text>
                <Text style={styles.reactionSummaryCount}>{reaction.count}</Text>
              </View>
            ))}
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      {/* Quick Reactions */}
      <View style={styles.quickReactions}>
        <TouchableOpacity
          onPress={() => handleReaction('❤️')}
          style={[
            styles.reactionButton,
            getReactionInfo('❤️').hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <Ionicons
            name={getReactionInfo('❤️').hasReacted ? 'heart' : 'heart-outline'}
            size={20}
            color={getReactionInfo('❤️').hasReacted ? colors.social.like : colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('👍')}
          style={[
            styles.reactionButton,
            getReactionInfo('👍').hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <Ionicons
            name={getReactionInfo('👍').hasReacted ? 'thumbs-up' : 'thumbs-up-outline'}
            size={20}
            color={getReactionInfo('👍').hasReacted ? colors.primary[500] : colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('👏')}
          style={[
            styles.reactionButton,
            getReactionInfo('👏').hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <Ionicons
            name={getReactionInfo('👏').hasReacted ? 'hand-right' : 'hand-right-outline'}
            size={20}
            color={getReactionInfo('👏').hasReacted ? colors.social.celebrate : colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('😂')}
          style={[
            styles.reactionButton,
            getReactionInfo('😂').hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <Ionicons
            name={getReactionInfo('😂').hasReacted ? 'happy' : 'happy-outline'}
            size={20}
            color={getReactionInfo('😂').hasReacted ? colors.social.laugh : colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('🔥')}
          style={[
            styles.reactionButton,
            getReactionInfo('🔥').hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <Ionicons
            name={getReactionInfo('🔥').hasReacted ? 'flame' : 'flame-outline'}
            size={20}
            color={getReactionInfo('🔥').hasReacted ? colors.warning.main : colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPress}
          style={styles.commentButton}
          activeOpacity={0.6}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.text.secondary} />
          {commentCount > 0 && (
            <Text style={styles.commentCountText}>{commentCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {showCommentPreview && previewComments.length > 0 && (
        <View style={styles.commentPreviewContainer}>
          {previewComments.map(renderCommentPreview)}
          {hasMoreComments && (
            <Text style={styles.viewMoreComments}>view more comments</Text>
          )}
        </View>
      )}

      <ReactionDetailsModal
        visible={showReactionModal}
        onClose={() => setShowReactionModal(false)}
        reactions={detailedReactions}
        loading={loadingReactionDetails}
      />
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  reactionsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.base,
    marginBottom: spacing[2],
  },
  reactionsSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  reactionSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  reactionSummaryEmoji: {
    fontSize: typography.fontSize.base,
  },
  reactionSummaryCount: {
    fontSize: typography.fontSize.sm,
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
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  reactionButton: {
    padding: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
  },
  reactionButtonActive: {
    backgroundColor: colors.primary[50],
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    padding: spacing[2],
    marginLeft: 'auto',
  },
  commentCountText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
});
