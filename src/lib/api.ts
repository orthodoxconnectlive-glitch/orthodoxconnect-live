/**
 * OrthodoxConnect Edge API Client
 * 100% Cloudflare Workers + D1 SQLite Backend
 */

import { User, UserProfile, Post, Message, EventItem, Story, NotificationItem, ContentReport, Church, MarketplaceListing } from '../types';

export const API_BASE_URL = '';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('orthodox_auth_token') || null;
  } catch (e) {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('orthodox_auth_token', token);
    } else {
      localStorage.removeItem('orthodox_auth_token');
    }
  } catch (e) {}
}

// In-memory profile set by AuthContext (more reliable than localStorage which can be empty)
let memoryAuthProfile: { id?: string; email?: string; role?: string } | null = null;

export function setMemoryAuthProfile(p: { id?: string; email?: string; role?: string } | null): void {
  memoryAuthProfile = p;
}

export function getAuthProfile(): { id?: string; email?: string; role?: string } | null {
  // 1. In-memory (set by AuthContext on every profile change) — most reliable
  if (memoryAuthProfile?.id || memoryAuthProfile?.email) {
    return memoryAuthProfile;
  }
  // 2. localStorage fallback
  try {
    const raw = localStorage.getItem('orthodox_user_profile');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { id: p?.id, email: p?.email, role: p?.role };
  } catch (e) {
    return null;
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const authProfile = getAuthProfile();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Identify the user to the Worker so owner/admin checks work (delete, edit, etc.)
  if (authProfile?.id && !headers['x-user-id']) {
    headers['x-user-id'] = authProfile.id;
  }
  if (authProfile?.email && !headers['x-user-email']) {
    headers['x-user-email'] = authProfile.email;
  }
  if (authProfile?.role && !headers['x-user-role']) {
    headers['x-user-role'] = authProfile.role;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `API error: ${res.statusText} (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) errMsg = errJson.error;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return res.json();
}

/* =========================================================
   AUTH API (Cloudflare Edge D1)
========================================================= */

export const authApi = {
  async signUp(data: {
    email: string;
    password?: string;
    fullName?: string;
    parish?: string;
    bio?: string;
    avatarUrl?: string;
    role?: string;
  }): Promise<{ user: User; profile: UserProfile; token: string }> {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password || 'parish123',
        full_name: data.fullName,
        parish: data.parish,
        bio: data.bio,
        avatar_url: data.avatarUrl,
        role: data.role || 'user',
      }),
    });

    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async signIn(email: string, password?: string): Promise<{ user: User; profile: UserProfile; token: string }> {
    const res = await apiFetch('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: password || 'parish123',
      }),
    });

    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async getSession(): Promise<{ user: User | null; profile: UserProfile | null }> {
    const token = getAuthToken();
    if (!token) return { user: null, profile: null };

    try {
      const res = await apiFetch(`/api/auth/session?token=${encodeURIComponent(token)}`);
      return { user: res.user || null, profile: res.profile || null };
    } catch (e) {
      return { user: null, profile: null };
    }
  },

  async signOut(): Promise<void> {
    const token = getAuthToken();
    if (token) {
      try {
        await apiFetch('/api/auth/signout', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
      } catch (e) {}
    }
    setAuthToken(null);
  },

  async updatePassword(password: string, userId?: string): Promise<void> {
    await apiFetch('/api/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password, user_id: userId }),
    });
  },
};

/* =========================================================
   PROFILES API (Cloudflare D1)
========================================================= */

export const profilesApi = {
  async getAll(role?: string, excludeId?: string): Promise<UserProfile[]> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (excludeId) params.set('exclude_id', excludeId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<{ profiles: UserProfile[] }>(`/api/profiles${qs}`);
    return res.profiles || [];
  },

  async getById(id: string): Promise<UserProfile | null> {
    try {
      const res = await apiFetch<{ profile: UserProfile }>(`/api/profiles/${encodeURIComponent(id)}`);
      return res.profile || null;
    } catch (e) {
      return null;
    }
  },

  async update(id: string, updates: Partial<UserProfile>): Promise<void> {
    await apiFetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

/* =========================================================
   POSTS API (Cloudflare D1)
========================================================= */

export const postsApi = {
  async getAll(options: { limit?: number; offset?: number; authorId?: string; groupId?: string; videosOnly?: boolean } = {}): Promise<Post[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.authorId) params.set('author_id', options.authorId);
    if (options.groupId) params.set('group_id', options.groupId);
    if (options.videosOnly) params.set('videos_only', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<{ posts: any[] }>(`/api/posts${qs}`);
    return res.posts || [];
  },

  async create(postData: Partial<Post>): Promise<Post> {
    const res = await apiFetch<{ post: Post }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
    return res.post;
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async toggleLike(postId: string, user: { id: string; name: string; avatar?: string }): Promise<{ is_liked: boolean; likes_count: number }> {
    return apiFetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        author_name: user.name,
        author_avatar: user.avatar,
      }),
    });
  },

  async getComments(postId: string): Promise<any[]> {
    const res = await apiFetch<{ comments: any[] }>(`/api/posts/${encodeURIComponent(postId)}/comments`);
    return res.comments || [];
  },

  async addComment(postId: string, content: string, user: { id: string; name: string; avatar?: string }): Promise<any> {
    const res = await apiFetch<{ comment: any }>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        user_id: user.id,
        author_name: user.name,
        author_avatar: user.avatar,
      }),
    });
    return res.comment;
  },
};

/* =========================================================
   MESSAGES API (Cloudflare D1)
========================================================= */

export const messagesApi = {
  async getChat(user1: string, user2: string): Promise<Message[]> {
    const res = await apiFetch<{ messages: Message[] }>(`/api/messages?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`);
    return res.messages || [];
  },

  async getConversation(userId: string, partnerId?: string): Promise<Message[]> {
    if (partnerId) {
      return this.getChat(userId, partnerId);
    }
    const res = await apiFetch<{ messages: Message[] }>(`/api/messages?user1=${encodeURIComponent(userId)}`);
    return res.messages || [];
  },

  async send(message: Partial<Message>): Promise<Message> {
    const res = await apiFetch<{ message: Message }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
    return res.message;
  },
};

/* =========================================================
   STORIES API (Cloudflare D1)
========================================================= */

export const storiesApi = {
  async getAll(): Promise<Story[]> {
    const res = await apiFetch<{ stories: Story[] }>('/api/stories');
    return res.stories || [];
  },

  async create(story: Partial<Story>): Promise<Story> {
    const res = await apiFetch<{ story: Story }>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(story),
    });
    return res.story;
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/stories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

/* =========================================================
   CHURCHES API (Cloudflare D1)
========================================================= */

export const churchesApi = {
  async list(q?: string): Promise<Church[]> {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await apiFetch<{ churches: Church[] }>(`/api/churches${qs}`);
    return res.churches || [];
  },

  async get(id: string): Promise<Church | null> {
    const res = await apiFetch<{ church: Church }>(`/api/churches/${encodeURIComponent(id)}`);
    return res.church || null;
  },

  async create(church: Partial<Church>): Promise<Church> {
    const res = await apiFetch<{ church: Church }>('/api/churches', {
      method: 'POST',
      body: JSON.stringify(church),
    });
    return res.church;
  },

  async update(id: string, patch: Partial<Church>): Promise<Church> {
    const res = await apiFetch<{ church: Church }>(`/api/churches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.church;
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/churches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

/* =========================================================
   MARKETPLACE API (Cloudflare D1)
   ========================================================= */
export const marketplaceApi = {
  async list(q?: string, category?: string): Promise<MarketplaceListing[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch<{ listings: MarketplaceListing[] }>(`/api/marketplace${qs}`);
    return res.listings || [];
  },

  async get(id: string): Promise<MarketplaceListing | null> {
    const res = await apiFetch<{ listing: MarketplaceListing }>(`/api/marketplace/${encodeURIComponent(id)}`);
    return res.listing || null;
  },

  async create(listing: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const res = await apiFetch<{ listing: MarketplaceListing }>('/api/marketplace', {
      method: 'POST',
      body: JSON.stringify(listing),
    });
    return res.listing;
  },

  async update(id: string, patch: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const res = await apiFetch<{ listing: MarketplaceListing }>(`/api/marketplace/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.listing;
  },

  async remove(id: string): Promise<void> {
    await apiFetch(`/api/marketplace/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

/* =========================================================
   EVENTS API (Cloudflare D1)
========================================================= */

export const eventsApi = {
  async getAll(): Promise<EventItem[]> {
    const res = await apiFetch<{ events: EventItem[] }>('/api/events');
    return res.events || [];
  },

  async create(event: Partial<EventItem>): Promise<EventItem> {
    const res = await apiFetch<{ event: EventItem }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    return res.event;
  },

  async update(id: string, updates: Partial<EventItem>): Promise<void> {
    await apiFetch(`/api/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

/* =========================================================
   LIVE STREAMS API (Cloudflare D1)
========================================================= */

export const liveStreamsApi = {
  async getAll(): Promise<any[]> {
    const res = await apiFetch<{ live_streams: any[] }>('/api/live-streams');
    return res.live_streams || [];
  },

  async create(stream: any): Promise<any> {
    const res = await apiFetch<{ stream: any }>('/api/live-streams', {
      method: 'POST',
      body: JSON.stringify(stream),
    });
    return res.stream;
  },

  async update(id: string, patch: any): Promise<any> {
    const res = await apiFetch<{ stream: any }>(`/api/live-streams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.stream;
  },
};

/* =========================================================
   CONTENT REPORTS API (Cloudflare D1)
========================================================= */

export const reportsApi = {
  async getAll(): Promise<ContentReport[]> {
    const res = await apiFetch<{ reports: any[] }>('/api/content-reports');
    return (res.reports || []).map((r: any) => ({
      id: String(r.id),
      targetType: r.target_type,
      targetId: r.target_id,
      targetContentPreview: r.target_content_preview || undefined,
      targetAuthorName: r.target_author_name || undefined,
      targetAuthorId: r.target_author_id || undefined,
      reporterId: r.reporter_id || 'me',
      reporterName: r.reporter_name || 'Parish Member',
      reason: r.reason || 'inappropriate',
      details: r.details || undefined,
      status: r.status || 'pending',
      createdAt: r.created_at || new Date().toISOString(),
    }));
  },

  async create(report: Partial<ContentReport>): Promise<any> {
    return apiFetch('/api/content-reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  },

  async updateStatus(id: string, status: string): Promise<void> {
    await apiFetch(`/api/content-reports/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
};
