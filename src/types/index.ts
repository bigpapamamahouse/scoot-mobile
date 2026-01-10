
export type Post = {
  id: string;
  userId: string;
  handle?: string | null;
  text: string;
  imageKey?: string | null;
  imageAspectRatio?: number | null;
  avatarKey?: string | null;
  createdAt: number;
};
export type Notification = {
  id: string;
  type: string;
  fromUserId: string;
  fromHandle?: string | null;
  postId?: string | null;
  message?: string;
  read?: boolean;
  createdAt: number;
  avatarKey?: string | null;
  userUrl?: string;
  postUrl?: string;
};

// Scoop (Stories) Types
export type ScoopMediaType = 'image' | 'video';

export type ScoopFontFamily = 'default' | 'bold' | 'script' | 'mono';

export type ScoopTextOverlay = {
  id: string;
  text: string;
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  fontFamily: ScoopFontFamily;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  rotation?: number;
};

export type Scoop = {
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
};

export type ScoopViewer = {
  userId: string;
  handle?: string | null;
  avatarKey?: string | null;
  viewedAt: number;
};

export type UserScoops = {
  userId: string;
  handle?: string | null;
  avatarKey?: string | null;
  scoops: Scoop[];
  hasUnviewed: boolean;
  latestScoopAt: number;
};
