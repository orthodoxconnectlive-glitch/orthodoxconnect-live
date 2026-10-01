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
  videoUrl?: string | null;
  video_url?: string | null;
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
  reaction_counts?: Record<string, number>;
  reactions_count?: number;
  my_emoji?: string | null;
}

export interface Church {
  id: string;
  name: string;
  avatar?: string;
  cover?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  priest_name?: string;
  phone?: string;
  website?: string;
  service_times?: string;
  owner_id?: string;
  created_at?: string;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description?: string;
  price?: string;
  category?: string;
  images?: string[];
  address?: string;
  city?: string;
  phone?: string;
  church_id?: string;
  church_name?: string;
  seller_id?: string;
  seller_name?: string;
  seller_avatar?: string;
  status?: 'active' | 'sold';
  created_at?: string;
}

export interface GroupRoom {
  id: string;
  name: string;
  name_ar?: string;
  name_en?: string;
  type: 'bible_study' | 'youth' | 'choir' | 'women_prayer' | 'parish_live' | 'philanthropy' | 'general';
  description: string;
  description_ar?: string;
  description_en?: string;
  activeCount: number;
  membersCount?: number;
  icon: string;
  hostName: string;
  host_id?: string;
  parish: string;
  creator_id?: string;
  isUserCreated?: boolean;
  created_at?: string;
}

export interface PostComment {
  id: string;
  post_id?: string;
  postId?: string;
  user_id?: string;
  userId?: string;
  author_name?: string;
  authorName?: string;
  author_avatar?: string;
  authorAvatar?: string;
  content?: string;
  mentions?: { id: string; name: string }[] | string;
  created_at?: string;
  createdAt?: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  type?: string;
  title?: string;
  body?: string;
  link?: string;
  senderName?: string;
  senderAvatar?: string;
  isRead?: boolean;
  createdAt?: string;
  post_id?: string;
  postId?: string;
}
