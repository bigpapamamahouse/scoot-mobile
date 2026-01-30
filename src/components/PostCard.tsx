import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ImageViewing from 'react-native-image-viewing';
import { Post, Reaction, ReactionWithUsers, Comment, PostImage } from '../types';
import { optimizedMediaUrl, ImagePresets } from '../lib/media';
import { Avatar } from './Avatar';
import { MentionText } from './MentionText';
import { ImageGallery } from './ImageGallery';
import { ImageGalleryViewer } from './ImageGalleryViewer';
import { SpotifyCard } from './SpotifyCard';
import { CommentsAPI, ReactionsAPI, PostsAPI, ModerationAPI } from '../api';
import { resolveHandle } from '../lib/resolveHandle';
import { useCurrentUser, isOwner } from '../hooks/useCurrentUser';
import { IconButton, Badge } from './ui';
import { useTheme, spacing, typography, borderRadius, shadows } from '../theme';
import { ReactionDetailsModal } from './ReactionDetailsModal';
import { imageDimensionCache } from '../lib/imageCache';

function PostCard({
  post,
  onPress,
  onPressAuthor,
  onPressUser,
  showCommentPreview = true,
  onPostUpdated,
  onPostDeleted,
  initialReactions,
  onReactionsUpdated,
  allowImageZoom = false,
}: {
  post: Post;
  onPress?: () => void;
  onPressAuthor?: () => void;
  onPressUser?: (userId: string, userHandle?: string) => void;
  showCommentPreview?: boolean;
  onPostUpdated?: (updatedPost: Post) => void;
  onPostDeleted?: (postId: string) => void;
  initialReactions?: any;
  onReactionsUpdated?: (reactions: any) => void;
  allowImageZoom?: boolean;
}) {
  const { colors } = useTheme();
  const { currentUser } = useCurrentUser();
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [detailedReactions, setDetailedReactions] = React.useState<ReactionWithUsers[]>([]);
  const [showReactionModal, setShowReactionModal] = React.useState(false);
  const [selectedEmoji, setSelectedEmoji] = React.useState<string | null>(null);
  const [loadingReactionDetails, setLoadingReactionDetails] = React.useState(false);
  const [commentCount, setCommentCount] = React.useState(
    post.commentCount ?? post.comments?.length ?? 0
  );
  const [previewComments, setPreviewComments] = React.useState<Comment[]>(
    () => (post.comments || []).slice(0, 3)
  );
  const [imageAspectRatio, setImageAspectRatio] = React.useState<number | null>(null);
  const [localPost, setLocalPost] = React.useState<Post>(post);
  const [imageViewerVisible, setImageViewerVisible] = React.useState(false);
  const [imageViewerIndex, setImageViewerIndex] = React.useState(0);

  // Use optimized image URL for feed display (800px wide, 85% quality)
  const imageUri = React.useMemo(
    () => optimizedMediaUrl(localPost.imageKey, ImagePresets.feedFull),
    [localPost.imageKey]
  );

  // For full-screen viewer, use higher quality (1200px wide, 90% quality)
  const fullScreenImageUri = React.useMemo(
    () => optimizedMediaUrl(localPost.imageKey, ImagePresets.fullScreen),
    [localPost.imageKey]
  );

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

  const handleReport = () => {
    Alert.prompt(
      'Report Post',
      'Please describe why you are reporting this post:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Report',
          style: 'destructive',
          onPress: async (reason) => {
            if (!reason || !reason.trim()) {
              Alert.alert('Error', 'Please provide a reason for reporting');
              return;
            }
            try {
              await ModerationAPI.reportContent({
                contentType: 'post',
                contentId: localPost.id,
                reason: reason.trim(),
              });
              Alert.alert('Success', 'Thank you for your report. We will review it within 24 hours.');
            } catch (error) {
              console.error('Failed to report post:', error);
              Alert.alert('Error', 'Failed to submit report. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${localPost.handle || 'this user'}? You will no longer see their content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await ModerationAPI.blockUser(localPost.userId);
              Alert.alert(
                'User Blocked',
                `You have blocked @${localPost.handle || 'this user'}. You will no longer see their content.`
              );
              onPostDeleted?.(localPost.id); // Remove from feed
            } catch (error) {
              console.error('Failed to block user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleOptionsPress = () => {
    if (userOwnsPost) {
      // Show edit/delete options for own posts
      Alert.alert('Post Options', 'Choose an action:', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: handleEdit },
        { text: 'Delete', onPress: handleDelete, style: 'destructive' },
      ]);
    } else {
      // Show report/block options for other users' posts
      Alert.alert('Post Options', 'Choose an action:', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report Post', onPress: handleReport, style: 'destructive' },
        { text: 'Block User', onPress: handleBlock, style: 'destructive' },
      ]);
    }
  };

  // Load image dimensions - prefer post data, fallback to cache/fetch for old posts
  React.useEffect(() => {
    if (!imageUri) {
      setImageAspectRatio(null);
      return;
    }

    // Use aspect ratio from post data if available (eliminates delay completely!)
    if (localPost.imageAspectRatio) {
      setImageAspectRatio(localPost.imageAspectRatio);
      return;
    }

    // Fallback: fetch dimensions for old posts without aspect ratio
    let cancelled = false;
    imageDimensionCache.fetch(imageUri).then((dimensions) => {
      if (!cancelled) {
        setImageAspectRatio(dimensions.aspectRatio);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageUri, localPost.imageAspectRatio]);

  React.useEffect(() => {
    setCommentCount(post.commentCount ?? post.comments?.length ?? 0);
    if (post.comments) {
      setPreviewComments(post.comments.slice(0, 3));
    }
  }, [post.commentCount, post.comments]);

  // Load reactions - use initialReactions if provided to prevent N+1 queries
  React.useEffect(() => {
    if (initialReactions !== undefined) {
      // Use batched reactions from parent
      const reactionsData = parseReactionsResponse(initialReactions);
      setReactions(reactionsData);
      return;
    }

    // Fallback: fetch individually if not batched (e.g., PostScreen)
    ReactionsAPI.getReactions(post.id)
      .then((data) => {
        const reactionsData = parseReactionsResponse(data);
        setReactions(reactionsData);
      })
      .catch((e) => {
        // Silently fail - reactions are not critical for viewing posts
        // Avoid logging 503 errors which are temporary service issues
      });
  }, [post.id, initialReactions]);

  const handleReaction = async (emoji: string) => {
    // Store current state for potential rollback
    const previousReactions = reactions;

    // Find current reaction state
    const currentReaction = reactions.find(r => r.emoji === emoji);
    const wasReacted = currentReaction?.userReacted || false;
    const currentCount = currentReaction?.count || 0;

    // Calculate optimistic update
    const newCount = wasReacted ? currentCount - 1 : currentCount + 1;
    const newUserReacted = !wasReacted;

    // Apply optimistic update immediately for instant UI feedback
    let optimisticReactions: Reaction[];
    if (currentReaction) {
      // Update existing reaction
      optimisticReactions = reactions
        .map(r => r.emoji === emoji
          ? { ...r, count: newCount, userReacted: newUserReacted }
          : r
        )
        .filter(r => r.count > 0); // Remove reactions with 0 count
    } else {
      // Add new reaction
      optimisticReactions = [
        ...reactions,
        { emoji, count: newCount, userReacted: newUserReacted }
      ];
    }

    setReactions(optimisticReactions);

    try {
      // Send toggle request to backend
      await ReactionsAPI.toggleReaction(post.id, emoji);

      // Fetch fresh data to ensure sync with server
      const data = await ReactionsAPI.getReactions(post.id);
      const reactionsData = parseReactionsResponse(data);
      setReactions(reactionsData);

      // Notify parent component of reaction update
      onReactionsUpdated?.(data);
    } catch (e: any) {
      console.error('Failed to toggle reaction:', e);
      // Revert optimistic update on error
      setReactions(previousReactions);
    }
  };

  const handleShowReactionDetails = async (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowReactionModal(true);
    setLoadingReactionDetails(true);

    try {
      const data = await ReactionsAPI.getReactionsWho(post.id);

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

      setDetailedReactions(reactionsWithUsers);
    } catch (e: any) {
      console.error('Failed to load reaction details:', e);
      Alert.alert('Error', 'Failed to load reaction details');
    } finally {
      setLoadingReactionDetails(false);
    }
  };

  // Lazy load comment previews - only if already provided by post data
  // Prevents N+1 query problem by not fetching comments for every post in feed
  React.useEffect(() => {
    if (!showCommentPreview) {
      setPreviewComments([]);
      return;
    }

    // Only use comments if already provided with the post (e.g., from backend)
    // Don't fetch separately to avoid N+1 queries
    if (post.comments && post.comments.length) {
      setPreviewComments(post.comments.slice(0, 3));
    } else {
      // Don't load - comment previews are not critical for feed display
      // Users can tap the post to see full comments
      setPreviewComments([]);
    }
  }, [post.comments, showCommentPreview]);

  const renderCommentPreview = (comment: Comment) => {
    const handle = resolveHandle(comment);
    const fallbackId =
      typeof comment.userId === 'string' && comment.userId.trim()
        ? `@${comment.userId.trim().slice(0, 8)}`
        : 'Anonymous';
    const displayHandle = handle ? `@${handle}` : fallbackId;
    return (
      <View key={comment.id} style={styles.commentPreviewRow}>
        <TouchableOpacity
          onPress={() => {
            if (comment.userId) {
              onPressUser?.(comment.userId, handle);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.commentPreviewHandle}>{displayHandle}</Text>
        </TouchableOpacity>
        <Text style={styles.commentPreviewText}>{comment.text}</Text>
      </View>
    );
  };

  // Memoize reaction info for each emoji to avoid repeated calculations
  const heartInfo = React.useMemo(() => {
    const reaction = reactions.find(r => r.emoji === '❤️');
    return { hasReacted: reaction?.userReacted || false, count: reaction?.count || 0 };
  }, [reactions]);

  const thumbsUpInfo = React.useMemo(() => {
    const reaction = reactions.find(r => r.emoji === '👍');
    return { hasReacted: reaction?.userReacted || false, count: reaction?.count || 0 };
  }, [reactions]);

  const clapInfo = React.useMemo(() => {
    const reaction = reactions.find(r => r.emoji === '👏');
    return { hasReacted: reaction?.userReacted || false, count: reaction?.count || 0 };
  }, [reactions]);

  const laughInfo = React.useMemo(() => {
    const reaction = reactions.find(r => r.emoji === '😂');
    return { hasReacted: reaction?.userReacted || false, count: reaction?.count || 0 };
  }, [reactions]);

  const fireInfo = React.useMemo(() => {
    const reaction = reactions.find(r => r.emoji === '🔥');
    return { hasReacted: reaction?.userReacted || false, count: reaction?.count || 0 };
  }, [reactions]);

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
          <IconButton
            icon="ellipsis-horizontal"
            onPress={handleOptionsPress}
            variant="ghost"
            size="sm"
            color={colors.text.secondary}
          />
        </View>
      </View>

      {/* Content */}
      <MentionText
        text={localPost.text}
        style={styles.text}
        onPressMention={(handle) => {
          onPressUser?.(handle, handle);
        }}
      />

      {/* Spotify Embed */}
      {localPost.spotifyEmbed && (
        <SpotifyCard embed={localPost.spotifyEmbed} />
      )}

      {/* Image Gallery */}
      {localPost.images && localPost.images.length > 0 ? (
        <ImageGallery
          images={localPost.images}
          onPress={(index) => {
            if (allowImageZoom) {
              setImageViewerIndex(index);
              setImageViewerVisible(true);
            }
          }}
          style={styles.imageGallery}
        />
      ) : imageUri ? (
        // Fallback for legacy posts with single imageKey
        allowImageZoom ? (
          <Pressable onPress={() => setImageViewerVisible(true)}>
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
          </Pressable>
        ) : (
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
        )
      ) : null}

      {/* Reactions */}
      <View style={styles.quickReactions}>
        <TouchableOpacity
          onPress={() => handleReaction('❤️')}
          onLongPress={() => heartInfo.count > 0 && handleShowReactionDetails('❤️')}
          style={[
            styles.reactionButton,
            heartInfo.hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name="heart"
            size={20}
            color={heartInfo.hasReacted ? colors.social.like : colors.text.secondary}
            style={!heartInfo.hasReacted && { opacity: 0.6 }}
          />
          {heartInfo.count > 0 && (
            <Text style={[
              styles.reactionCount,
              heartInfo.hasReacted && { color: colors.social.like }
            ]}>
              {heartInfo.count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('👍')}
          onLongPress={() => thumbsUpInfo.count > 0 && handleShowReactionDetails('👍')}
          style={[
            styles.reactionButton,
            thumbsUpInfo.hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name="thumb-up"
            size={20}
            color={thumbsUpInfo.hasReacted ? colors.primary[500] : colors.text.secondary}
            style={!thumbsUpInfo.hasReacted && { opacity: 0.6 }}
          />
          {thumbsUpInfo.count > 0 && (
            <Text style={[
              styles.reactionCount,
              thumbsUpInfo.hasReacted && { color: colors.primary[500] }
            ]}>
              {thumbsUpInfo.count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('👏')}
          onLongPress={() => clapInfo.count > 0 && handleShowReactionDetails('👏')}
          style={[
            styles.reactionButton,
            clapInfo.hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name="hand-clap"
            size={20}
            color={clapInfo.hasReacted ? colors.social.celebrate : colors.text.secondary}
            style={!clapInfo.hasReacted && { opacity: 0.6 }}
          />
          {clapInfo.count > 0 && (
            <Text style={[
              styles.reactionCount,
              clapInfo.hasReacted && { color: colors.social.celebrate }
            ]}>
              {clapInfo.count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('😂')}
          onLongPress={() => laughInfo.count > 0 && handleShowReactionDetails('😂')}
          style={[
            styles.reactionButton,
            laughInfo.hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name="emoticon-lol"
            size={20}
            color={laughInfo.hasReacted ? colors.social.laugh : colors.text.secondary}
            style={!laughInfo.hasReacted && { opacity: 0.6 }}
          />
          {laughInfo.count > 0 && (
            <Text style={[
              styles.reactionCount,
              laughInfo.hasReacted && { color: colors.social.laugh }
            ]}>
              {laughInfo.count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleReaction('🔥')}
          onLongPress={() => fireInfo.count > 0 && handleShowReactionDetails('🔥')}
          style={[
            styles.reactionButton,
            fireInfo.hasReacted && styles.reactionButtonActive,
          ]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name="fire"
            size={20}
            color={fireInfo.hasReacted ? colors.warning.main : colors.text.secondary}
            style={!fireInfo.hasReacted && { opacity: 0.6 }}
          />
          {fireInfo.count > 0 && (
            <Text style={[
              styles.reactionCount,
              fireInfo.hasReacted && { color: colors.warning.main }
            ]}>
              {fireInfo.count}
            </Text>
          )}
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
        onClose={() => {
          setShowReactionModal(false);
          setSelectedEmoji(null);
        }}
        reactions={selectedEmoji
          ? detailedReactions.filter(r => r.emoji === selectedEmoji)
          : detailedReactions
        }
        loading={loadingReactionDetails}
        onUserPress={onPressUser}
      />

      {allowImageZoom && (localPost.images?.length || fullScreenImageUri) && (
        localPost.images && localPost.images.length > 0 ? (
          <ImageGalleryViewer
            images={localPost.images}
            initialIndex={imageViewerIndex}
            visible={imageViewerVisible}
            onClose={() => setImageViewerVisible(false)}
          />
        ) : fullScreenImageUri ? (
          <ImageViewing
            images={[{ uri: fullScreenImageUri }]}
            imageIndex={0}
            visible={imageViewerVisible}
            onRequestClose={() => setImageViewerVisible(false)}
          />
        ) : null
      )}
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
  imageGallery: {
    marginBottom: spacing[2],
  },
  image: {
    width: '100%',
    borderRadius: borderRadius.base,
    marginBottom: spacing[2],
    backgroundColor: colors.neutral[100],
  },
  imageFallback: {
    aspectRatio: 4 / 3, // More natural default than 1:1 square, reduces layout shift
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
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
  },
  reactionButtonActive: {
    backgroundColor: colors.primary[50],
  },
  reactionCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
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

// Memoize PostCard to prevent unnecessary re-renders when parent updates
// Only re-render if post.id changes or callbacks change
export default React.memo(PostCard, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.text === nextProps.post.text &&
    prevProps.post.imageKey === nextProps.post.imageKey &&
    prevProps.post.spotifyEmbed?.spotifyId === nextProps.post.spotifyEmbed?.spotifyId &&
    prevProps.showCommentPreview === nextProps.showCommentPreview &&
    prevProps.initialReactions === nextProps.initialReactions
  );
});
