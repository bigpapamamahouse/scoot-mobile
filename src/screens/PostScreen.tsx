import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import PostCard from '../components/PostCard';
import { CommentsAPI, PostsAPI } from '../api';
import { Comment, Post } from '../types';
import { Avatar } from '../components/Avatar';
import { resolveHandle } from '../lib/resolveHandle';

interface PostScreenRoute {
  params?: {
    post?: Post;
    postId?: string;
  };
}

export default function PostScreen({ route, navigation }: { route: PostScreenRoute; navigation: any }) {
  const initialPost = route?.params?.post ?? null;
  const postId = route?.params?.postId ?? initialPost?.id;

  const [post, setPost] = React.useState<Post | null>(initialPost);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [newComment, setNewComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

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

  const loadComments = React.useCallback(async () => {
    if (!postId) {
      return;
    }
    setLoading(true);
    try {
      const result = await CommentsAPI.listComments(postId);
      const dataArray = Array.isArray(result)
        ? result
        : result?.comments || result?.items || [];
      const totalCount: number =
        typeof result?.count === 'number'
          ? result.count
          : typeof result?.total === 'number'
          ? result.total
          : dataArray.length;
      setComments(dataArray);
      setPost((prev) =>
        prev ? { ...prev, commentCount: totalCount } : prev
      );
    } catch (err) {
      console.warn('Failed to load comments', err);
    } finally {
      setLoading(false);
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
      const result = await CommentsAPI.addComment(postId, trimmed);
      const created: Comment | null = (result && (result.comment || result.item || result.data || result)) || null;
      if (created) {
        setComments((prev) => [...prev, created]);
        setPost((prev) => {
          if (!prev) {
            return prev;
          }
          const nextCount = (prev.commentCount || 0) + 1;
          return { ...prev, commentCount: nextCount };
        });
      }
      setNewComment('');
    } catch (err) {
      console.warn('Failed to submit comment', err);
    } finally {
      setSubmitting(false);
    }
  }, [newComment, postId, submitting]);

  const renderComment = ({ item }: { item: Comment }) => {
    const anyComment: any = item;
    const handleCandidate = resolveHandle(anyComment);
    const handle = handleCandidate ? `@${handleCandidate}` : 'Anonymous';
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
    return (
      <View style={styles.commentRow}>
        <Avatar avatarKey={anyComment?.avatarKey} size={28} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentHandle}>{handle}</Text>
            {!!createdAt && <Text style={styles.commentTimestamp}>{createdAt}</Text>}
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        style={styles.list}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadComments} />
        }
        ListHeaderComponent={
          post ? (
            <View style={styles.postContainer}>
              <PostCard
                post={post}
                onPressAuthor={() => openProfile(post)}
                showCommentPreview={false}
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
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment"
          value={newComment}
          onChangeText={setNewComment}
          multiline
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  listContent: {
    padding: 12,
    paddingBottom: 120,
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
  },
  loadingPost: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 24,
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
    gap: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentHandle: {
    fontWeight: '600',
    fontSize: 14,
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#2196f3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#a0c8f6',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
