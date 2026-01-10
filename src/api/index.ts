// API exports
import * as posts from './posts';
import * as users from './users';
import * as comments from './comments';
import * as reactions from './reactions';
import * as notifications from './notifications';
import * as invites from './invites';
import * as moderation from './moderation';
import * as scoops from './scoops';

export const PostsAPI = posts;
export const UsersAPI = users;
export const CommentsAPI = comments;
export const ReactionsAPI = reactions;
export const NotificationsAPI = notifications;
export const InvitesAPI = invites;
export const ModerationAPI = moderation;
export const ScoopsAPI = scoops;

export { api } from './client';
export * from './auth';
export { mediaUrlFromKey } from './media';
export type { CreatePostImage } from './posts';
