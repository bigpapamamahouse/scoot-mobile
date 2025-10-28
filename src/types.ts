// Common types used across the application

export interface Post {
  id: string;
  userId: string;
  handle?: string;
  avatarKey?: string;
  text: string;
  imageKey?: string;
  createdAt: string;
  updatedAt?: string;
  reactionCount?: number;
  commentCount?: number;
}

export interface User {
  id: string;
  handle?: string;
  avatarKey?: string;
  email?: string;
  createdAt: string;
  fullName?: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedUserId?: string;
  relatedPostId?: string;
  fromHandle?: string;
  fromUserId: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  handle?: string;
  text: string;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted?: boolean;
}
