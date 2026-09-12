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
