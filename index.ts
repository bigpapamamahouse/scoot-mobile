
export type Post = {
  id: string;
  userId: string;
  handle?: string | null;
  text: string;
  imageKey?: string | null;
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
