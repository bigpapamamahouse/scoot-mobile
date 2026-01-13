// Common types used across the application

export interface PostImage {
  key: string;                    // S3 key
  aspectRatio: number;           // width/height for layout optimization
  width?: number;                // Optional original dimensions
  height?: number;
  order: number;                 // Display order (0-9)
}

export interface Post {
  id: string;
  userId: string;
  handle?: string;
  avatarKey?: string;
  text: string;

  // Multi-image support
  images?: PostImage[];          // Array of up to 10 images

  // Deprecated: Keep for backward compatibility with old posts
  imageKey?: string;
  imageAspectRatio?: number;

  createdAt: string;
  updatedAt?: string;
  reactionCount?: number;
  commentCount?: number;
  comments?: Comment[];
}

export interface User {
  id: string;
  handle?: string;
  avatarKey?: string;
  email?: string;
  createdAt: string;
  fullName?: string;
  hasMutualConnection?: boolean; // Set to true if user has mutual followers/following with current user
  mutualFriendCount?: number; // Number of mutual friends (people who follow this user that you also follow)
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedUserId?: string;
  relatedPostId?: string;
  postId?: string | null;
  postUrl?: string;
  userUrl?: string;
  fromHandle?: string;
  fromUserId: string;
  avatarKey?: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  handle?: string;
  avatarKey?: string;
  text: string;
  createdAt?: string;
  parentCommentId?: string | null;
  replyCount?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}

export interface ReactionWithUsers {
  emoji: string;
  count: number;
  userReacted?: boolean;
  users?: Array<{
    id: string;
    handle?: string;
    avatarKey?: string;
  }>;
}

// Scoop (Stories) Types
export type ScoopMediaType = 'image' | 'video';

export type ScoopFontFamily = 'default' | 'bold' | 'script' | 'mono';

export interface ScoopTextOverlay {
  id: string;
  text: string;
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  fontFamily: ScoopFontFamily;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  rotation?: number; // degrees
  scale?: number; // 1.0 = normal size
}

export interface Scoop {
  id: string;
  userId: string;
  handle?: string | null;
  avatarKey?: string | null;
  mediaKey: string;
  mediaType: ScoopMediaType;
  mediaAspectRatio?: number | null;
  textOverlays?: ScoopTextOverlay[];
  createdAt: number;
  expiresAt: number;
  viewCount: number;
  viewed?: boolean; // whether current user has viewed this scoop
}

export interface ScoopViewer {
  userId: string;
  handle?: string | null;
  avatarKey?: string | null;
  viewedAt: number;
}

export interface UserScoops {
  userId: string;
  handle?: string | null;
  avatarKey?: string | null;
  scoops: Scoop[];
  hasUnviewed: boolean;
  latestScoopAt: number;
}
