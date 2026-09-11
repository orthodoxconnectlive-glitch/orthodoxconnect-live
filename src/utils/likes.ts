/**
 * Dedicated Like & Bless Interaction Utility for OrthodoxConnect
 * Guarantees persistent per-device/user isolation to eliminate identity collision.
 */

import { getAuthHeaders, invalidatePostsCache } from './posts';
import { addNotification } from './notifications';

// Ensures an isolated identity per browser/device even if the user isn't logged in
export function getOrCreateClientIdentity(explicitProfile?: any): {
  userId: string;
  userName: string;
  userAvatar: string;
} {
  let profile = explicitProfile;

  if (!profile) {
    try {
      const stored =
        localStorage.getItem('orthodox_user_profile') ||
        localStorage.getItem('user') ||
        localStorage.getItem('profile');
      if (stored) profile = JSON.parse(stored);
    } catch (e) {}
  }

  // 1. Logged-in authenticated profile
  if (profile?.id) {
    return {
      userId: String(profile.id),
      userName: profile.full_name || profile.name || 'Orthodox Parishioner',
      userAvatar: profile.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    };
  }

  // 2. Email fallback
  if (profile?.email) {
    return {
      userId: `user-${profile.email.trim().toLowerCase()}`,
      userName: profile.full_name || profile.email.split('@')[0],
      userAvatar: profile.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    };
  }

  // 3. Unique client/device UUID (Never shares 'anonymous-user')
  let guestId = '';
  try {
    guestId = localStorage.getItem('orthodox_unique_client_id') || '';
    if (!guestId) {
      guestId = 'guest_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      localStorage.setItem('orthodox_unique_client_id', guestId);
    }
  } catch (e) {
    guestId = `guest_${Date.now()}`;
  }

  return {
    userId: guestId,
    userName: 'Orthodox Parishioner',
    userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  };
}

export async function blessPost(
  postId: string,
  userProfile?: any,
  postOwner?: { id: string | number } | null
): Promise<{ success: boolean; liked: boolean; likesCount: number; likers: any[] }> {
  const identity = getOrCreateClientIdentity(userProfile);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(userProfile),
    };

    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: identity.userId,
        user_name: identity.userName,
        user_avatar: identity.userAvatar,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      invalidatePostsCache();
      const liked = Boolean(data.is_liked ?? data.liked);

      // Notify the post owner — never for your own likes, never on unlike.
      // A notification failure must never break the like itself.
      const ownerId = postOwner?.id != null ? String(postOwner.id) : null;
      if (liked && ownerId && ownerId !== identity.userId) {
        try {
          await addNotification(
            {
              userId: ownerId,
              type: 'like',
              title: 'Post blessed',
              body: `${identity.userName} blessed your post`,
              link: 'feed',
              senderName: identity.userName,
              senderAvatar: identity.userAvatar,
            },
            identity.userId
          );
        } catch (notifErr) {
          console.warn('[blessPost notification]:', notifErr);
        }
      }

      return {
        success: true,
        liked,
        likesCount: Number(data.likes_count ?? 0),
        likers: data.likers || [],
      };
    }
  } catch (err) {
    console.error('[blessPost error]:', err);
  }

  return { success: false, liked: false, likesCount: 0, likers: [] };
}