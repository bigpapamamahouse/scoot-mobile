import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import PostCard from '../components/PostCard';
import { CommentsAPI, PostsAPI, UsersAPI } from '../api';
import { Comment, Post } from '../types';
import { Avatar } from '../components/Avatar';
import { MentionTextInput } from '../components/MentionTextInput';
import { MentionText } from '../components/MentionText';
import { resolveHandle } from '../lib/resolveHandle';
import { useCurrentUser, isOwner } from '../hooks/useCurrentUser';
import { useTheme } from '../theme/ThemeContext';

interface PostScreenRoute {
  params?: {
    post?: Post;
    postId?: string;
  };
}

// Helper function to normalize comment data and extract avatarKey from various possible fields
const normalizeComment = (comment: any): Comment => {
  // Try to find avatarKey from various possible field names
  const avatarKey =
    comment.avatarKey ||
    comment.avatar_key ||
    comment.avatar ||
    comment.avatarUrl ||
    comment.avatar_url ||
    comment.user?.avatarKey ||
    comment.user?.avatar_key ||
    comment.user?.avatar ||
    comment.author?.avatarKey ||
    comment.author?.avatar_key ||
    comment.author?.avatar ||
    null;

  return {
    ...comment,
    avatarKey: avatarKey,
  };
};

const COMMENTS_PER_PAGE = 30;

export default function PostScreen({ route, navigation }: { route: PostScreenRoute; navigation: any }) {
  const initialPost = route?.params?.post ?? null;
  const postId = route?.params?.postId ?? initialPost?.id;

  const { colors } = useTheme();
  const { currentUser } = useCurrentUser();
  const [post, setPost] = React.useState<Post | null>(initialPost);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [newComment, setNewComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [replyingTo, setReplyingTo] = React.useState<Comment | null>(null);

  const openProfile = React.useCallback(
    (targetPost: Post | null) => {
      if (!targetPost) {
        return;
      }
      const anyPost: any = targetPost;
      const handle = resolveHandle(anyPost);
      const userIdCandidate: unknown =
        anyPost?.userId ||
        anyPost?.user?.id ||
        anyPost?.authorId ||
        anyPost?.author?.id ||
        anyPost?.createdById ||
        anyPost?.profileId;

      const userId =
        typeof userIdCandidate === 'string' && userIdCandidate.trim()
          ? userIdCandidate.trim()
          : undefined;

      navigation.push('Profile', {
        userHandle: handle,
        userId: userId,
      });
    },
    [navigation]
  );

  const resolvePost = React.useCallback((value: any): Post | null => {
    if (!value) {
      return null;
    }
    if (value.post) {
      return value.post as Post;
    }
    if (value.item) {
      return value.item as Post;
    }
    if (value.data) {
      return value.data as Post;
    }
    return value as Post;
  }, []);

  const loadPost = React.useCallback(async () => {
    if (!postId) {
      return;
    }
    try {
      const result = await PostsAPI.getPost(postId);
      const resolved = resolvePost(result);
      if (resolved) {
        setPost(resolved);
      }
    } catch (err) {
      console.warn('Failed to load post', err);
    }
  }, [postId, resolvePost]);

  const loadComments = React.useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!postId) {
      return;
    }
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const offset = pageNum * COMMENTS_PER_PAGE;
      const result = await CommentsAPI.listComments(postId, {
        limit: COMMENTS_PER_PAGE,
        offset
      });

      const dataArray = Array.isArray(result)
        ? result
        : result?.comments || result?.items || [];

      // Normalize each comment to ensure avatarKey is properly extracted
      let normalizedComments = dataArray.map(normalizeComment);

      const totalCount: number =
        typeof result?.count === 'number'
          ? result.count
          : typeof result?.total === 'number'
          ? result.total
          : dataArray.length;

      // Fetch user avatars for comments that don't have avatarKey
      const commentsNeedingAvatars = normalizedComments.filter(c => !c.avatarKey && c.userId);
      if (commentsNeedingAvatars.length > 0) {
        // Get unique userIds
        const uniqueUserIds = [...new Set(commentsNeedingAvatars.map(c => c.userId))];

        // Fetch user data for each unique userId
        const userDataPromises = uniqueUserIds.map(async (userId) => {
          try {
            const userData = await UsersAPI.getUserByIdentity({ userId });
            return { userId, avatarKey: userData?.avatarKey || null };
          } catch (error) {
            console.warn('[PostScreen] Failed to fetch user data for', userId, error);
            return { userId, avatarKey: null };
          }
        });

        const userAvatars = await Promise.all(userDataPromises);
        const avatarMap = new Map(userAvatars.map(u => [u.userId, u.avatarKey]));

        // Merge avatar data into comments
        normalizedComments = normalizedComments.map(comment => {
          if (!comment.avatarKey && comment.userId && avatarMap.has(comment.userId)) {
            return { ...comment, avatarKey: avatarMap.get(comment.userId) || null };
          }
          return comment;
        });
      }

      if (append) {
        setComments((prev) => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueNewComments = normalizedComments.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNewComments];
        });
      } else {
        setComments(normalizedComments);
      }

      setHasMore(normalizedComments.length >= COMMENTS_PER_PAGE);
      setPost((prev) =>
        prev ? { ...prev, commentCount: totalCount } : prev
      );
    } catch (err) {
      console.warn('Failed to load comments', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [postId]);

  React.useEffect(() => {
    if (!post && postId) {
      loadPost();
    }
  }, [loadPost, post, postId]);

  React.useEffect(() => {
    loadComments();
  }, [loadComments]);

  React.useEffect(() => {
    if (post) {
      const handle = resolveHandle(post);
      const label = handle ? `Post by @${handle}` : 'Post';
      navigation.setOptions({ title: label });
    }
  }, [navigation, post]);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = newComment.trim();
    if (!postId || !trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const parentCommentId = replyingTo?.id;
      const result = await CommentsAPI.addComment(postId, trimmed, parentCommentId);

      const created: Comment | null = (result && (result.comment || result.item || result.data || result)) || null;
      if (created) {
        // Normalize the newly created comment to extract avatarKey
        let normalizedComment = normalizeComment(created);

        // If the new comment doesn't have an avatarKey, use the current user's avatar
        if (!normalizedComment.avatarKey && currentUser) {
          const userAvatar = (currentUser as any).avatarKey || null;
          normalizedComment = { ...normalizedComment, avatarKey: userAvatar };
        }

        setComments((prev) => [...prev, normalizedComment]);
        setPost((prev) => {
          if (!prev) {
            return prev;
          }
          const nextCount = (prev.commentCount || 0) + 1;
          return { ...prev, commentCount: nextCount };
        });
      }
      setNewComment('');
      setReplyingTo(null);
    } catch (err) {
      console.warn('Failed to submit comment', err);
    } finally {
      setSubmitting(false);
    }
  }, [newComment, postId, submitting, currentUser, replyingTo]);

  const handleEditComment = (comment: Comment) => {
    Alert.prompt(
      'Edit Comment',
      'Update your comment:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text) => {
            if (!text || !text.trim()) {
              Alert.alert('Error', 'Comment text cannot be empty');
              return;
            }
            if (!postId) return;
            try {
              await CommentsAPI.updateComment(postId, comment.id, text.trim());
              setComments((prev) =>
                prev.map((c) =>
                  c.id === comment.id ? { ...c, text: text.trim() } : c
                )
              );
              Alert.alert('Success', 'Comment updated successfully');
            } catch (error) {
              console.error('Failed to update comment:', error);
              Alert.alert('Error', 'Failed to update comment. Please try again.');
            }
          },
        },
      ],
      'plain-text',
      comment.text
    );
  };

  const handleDeleteComment = (comment: Comment) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!postId) return;
            try {
              await CommentsAPI.deleteComment(postId, comment.id);
              // Remove the comment and all its replies
              setComments((prev) => {
                const toRemove = new Set([comment.id]);
                // Find all replies to this comment
                prev.forEach(c => {
                  if (c.parentCommentId === comment.id) {
                    toRemove.add(c.id);
                  }
                });
                return prev.filter((c) => !toRemove.has(c.id));
              });
              setPost((prev) => {
                if (!prev) return prev;
                // Count how many comments were removed (parent + replies)
                const removedCount = comments.filter(c => c.id === comment.id || c.parentCommentId === comment.id).length;
                const nextCount = Math.max((prev.commentCount || 0) - removedCount, 0);
                return { ...prev, commentCount: nextCount };
              });
              Alert.alert('Success', 'Comment deleted successfully');
            } catch (error) {
              console.error('Failed to delete comment:', error);
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCommentOptions = (comment: Comment) => {
    Alert.alert('Comment Options', 'Choose an action:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => handleEditComment(comment) },
      { text: 'Delete', onPress: () => handleDeleteComment(comment), style: 'destructive' },
    ]);
  };

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setPage(nextPage);
    await loadComments(nextPage, true);
  }, [loadingMore, hasMore, page, loadComments]);

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const renderComment = ({ item, isReply = false }: { item: Comment; isReply?: boolean }) => {
    const anyComment: any = item;
    const handleCandidate = resolveHandle(anyComment);
    const fallbackId =
      typeof anyComment?.userId === 'string' && anyComment.userId.trim()
        ? `@${anyComment.userId.trim().slice(0, 8)}`
        : 'Anonymous';
    const handle = handleCandidate ? `@${handleCandidate}` : fallbackId;
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
    const userOwnsComment = isOwner(item, currentUser);

    // Find replies to this comment
    const replies = comments.filter(c => c.parentCommentId === item.id);

    return (
      <View style={[styles.commentRow, isReply && styles.replyRow]}>
        <Avatar avatarKey={anyComment?.avatarKey} size={isReply ? 24 : 28} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentHandle}>{handle}</Text>
            {!!createdAt && <Text style={styles.commentTimestamp}>{createdAt}</Text>}
            {userOwnsComment && (
              <TouchableOpacity
                onPress={() => handleCommentOptions(item)}
                style={styles.commentOptionsButton}
              >
                <Text style={styles.commentOptionsIcon}>⋯</Text>
              </TouchableOpacity>
            )}
          </View>
          <MentionText
            text={item.text}
            style={styles.commentText}
            onPressMention={(handle) => {
              navigation.push('Profile', {
                userHandle: handle,
              });
            }}
          />
          {!isReply && (
            <TouchableOpacity
              onPress={() => setReplyingTo(item)}
              style={styles.replyButton}
            >
              <Text style={styles.replyButtonText}>Reply</Text>
              {replies.length > 0 && (
                <Text style={styles.replyCount}>({replies.length})</Text>
              )}
            </TouchableOpacity>
          )}
          {replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {replies.map(reply => (
                <View key={reply.id}>
                  {renderComment({ item: reply, isReply: true })}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      <FlatList
        style={styles.list}
        data={comments.filter(c => !c.parentCommentId)}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => { setPage(0); setHasMore(true); loadComments(0, false); }} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          post ? (
            <View style={styles.postContainer}>
              <PostCard
                post={post}
                onPressAuthor={() => openProfile(post)}
                onPressUser={(userId, userHandle) => {
                  navigation.push('Profile', {
                    userHandle: userHandle,
                    userId: userId,
                  });
                }}
                showCommentPreview={false}
                allowImageZoom={true}
              />
              <Text style={styles.commentHeaderLabel}>Comments</Text>
            </View>
          ) : (
            <View style={styles.loadingPost}>
              <Text style={styles.loadingText}>Loading post...</Text>
            </View>
          )
        }
        ListEmptyComponent={!loading ? (
          <Text style={styles.emptyText}>No comments yet. Be the first to add one!</Text>
        ) : null}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <Text style={styles.loadingText}>Loading more comments...</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputContainer}>
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <Text style={styles.replyingToText}>
              Replying to @{resolveHandle(replyingTo) || 'user'}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.cancelReplyText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <MentionTextInput
            style={styles.input}
            placeholder={replyingTo ? "Write a reply..." : "Write a comment"}
            placeholderTextColor={colors.text.tertiary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            placement="above"
            autocompleteMaxHeight={250}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            style={[
              styles.sendButton,
              (!newComment.trim() || submitting) && styles.sendButtonDisabled,
            ]}
            disabled={!newComment.trim() || submitting}
          >
            <Text style={styles.sendButtonText}>{submitting ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  listContent: {
    padding: 12,
    paddingBottom: 140,
  },
  list: {
    flex: 1,
  },
  postContainer: {
    marginBottom: 16,
  },
  commentHeaderLabel: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loadingPost: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.tertiary,
    marginTop: 24,
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  commentHandle: {
    fontWeight: '600',
    fontSize: 14,
    color: colors.text.primary,
  },
  commentTimestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginLeft: 'auto',
  },
  commentOptionsButton: {
    padding: 4,
  },
  commentOptionsIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.secondary,
  },
  commentText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  replyRow: {
    marginLeft: 20,
    paddingVertical: 8,
  },
  replyButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[500],
  },
  replyCount: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  repliesContainer: {
    marginTop: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.main,
    backgroundColor: colors.background.primary,
    overflow: 'visible',
    zIndex: 100,
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  cancelReplyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.tertiary,
    paddingHorizontal: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontSize: 15,
    overflow: 'visible',
  },
  sendButton: {
    backgroundColor: colors.primary[500],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  sendButtonText: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
});
