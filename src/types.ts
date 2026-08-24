export type UserRole = 'super_admin' | 'admin' | 'user' | 'owner' | 'clergy';

export interface User {
  id: string;
  email?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: {
    full_name?: string;
    parish?: string;
    avatar_url?: string;
    bio?: string;
    role?: UserRole;
    [key: string]: any;
  };
  aud?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  parish: string;
  bio?: string;
  avatar_url?: string;
  role: UserRole;
  created_at?: string;
}

export interface Post {
  id: string;
  text?: string;
  content?: string;
  authorName?: string;
  author_name?: string;
  authorParish?: string;
  author_parish?: string;
  authorAvatar?: string;
  author_avatar?: string;
  authorId?: string;
  author_id?: string;
  image?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  video?: string | null;
  videoId?: string | null;
  video_id?: string | null;
  audio?: string;
  audioUrl?: string;
  audio_url?: string;
  broadcastUrl?: string;
  broadcast_url?: string;
  createdAt?: string;
  created_at?: string;
  groupId?: string;
  group_id?: string;
  likesCount?: number;
  likes_count?: number;
  commentsCount?: number;
  comments_count?: number;
  resharesCount?: number;
  reshares_count?: number;
  isLiked?: boolean;
  is_liked?: boolean;
  isReshared?: boolean;
  is_reshared?: boolean;
  quotedPost?: Post | null;
  quoted_post?: Post | null;
  reshareKind?: 'reshare' | 'quote';
  reshare_kind?: string;
  likers?: { userId: string; userName: string; userAvatar?: string }[];
}

export interface PostComment {
  id: string;
  post_id: string;
  postId?: string;
  user_id?: string;
  userId?: string;
  author_name: string;
  authorName?: string;
  author_avatar: string;
  authorAvatar?: string;
  content: string;
  created_at: string;
  createdAt?: string;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
  is_read?: boolean;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  audio_duration?: number;
}

export interface GroupRoom {
  id: string;
  name: string;
  type: 'bible_study' | 'youth' | 'choir' | 'women_prayer' | 'parish_live' | 'general' | 'philanthropy';
  description: string;
  activeCount: number;
  icon: string;
  hostName: string;
  parish: string;
  isLive?: boolean;
  streamUrl?: string;
  adminIds?: string[];
  membersCount?: number;
  isUserCreated?: boolean;
}

export interface CallState {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  type: 'audio' | 'video';
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
  isMuted: boolean;
  isVideoOff: boolean;
  startedAt?: number;
}

export interface LiturgicalDay {
  date: string;
  saintName: string;
  saintTitle: string;
  saintIconUrl?: string;
  scriptureRef: string;
  scriptureText: string;
  fastingInfo: string;
  fastingType: 'strict' | 'wine_oil' | 'fish' | 'fast_free';
  feastLevel?: 'major' | 'minor' | 'daily';
}

export type ThemeMode = 'dark' | 'light' | 'ancient';
export type Language = 'en' | 'ar';

export interface EventRsvp {
  userId: string;
  userName: string;
  userAvatar?: string;
  status: 'going' | 'interested' | 'not_going';
  createdAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  locationType: 'physical' | 'virtual';
  locationAddress?: string;
  virtualLink?: string;
  category: 'liturgy' | 'feast' | 'bible_study' | 'youth' | 'pilgrimage' | 'choir' | 'social';
  parish: string;
  hostName: string;
  hostAvatar?: string;
  hostId?: string;
  imageUrl?: string;
  createdAt: string;
  rsvps?: EventRsvp[];
  userRsvpStatus?: 'going' | 'interested' | 'not_going';
  goingCount: number;
  interestedCount: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'group_invite' | 'event_invite' | 'moderation_alert' | 'system' | 'like' | 'comment';
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}

export interface NotificationPreferences {
  messages: boolean;
  mentions: boolean;
  groupInvites: boolean;
  eventInvites: boolean;
  moderationAlerts: boolean;
  emailAlerts: boolean;
}

export interface ContentReport {
  id: string;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  targetContentPreview?: string;
  targetAuthorName?: string;
  targetAuthorId?: string;
  reporterId: string;
  reporterName: string;
  reason: 'inappropriate' | 'spam' | 'uncanonical_heresy' | 'harassment' | 'other';
  details?: string;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  createdAt: string;
}

export interface ModerationAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: 'dismiss' | 'remove_content' | 'warn_user' | 'ban_user' | 'unban_user';
  targetId: string;
  targetType: 'post' | 'comment' | 'user';
  reason: string;
  createdAt: string;
}

export interface UserModerationStatus {
  userId: string;
  warningCount: number;
  isBanned: boolean;
  banReason?: string;
  updatedAt: string;
}

export interface Story {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorParish: string;
  imageUrl: string;
  caption?: string;
  createdAt: string;
  isViewed?: boolean;
}
