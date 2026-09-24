import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserProfile, UserRole } from '../types';
import { authApi, profilesApi, setMemoryAuthProfile } from '../lib/api';
import { setCurrentUserId } from '../utils/notifications';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, parish: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  /** True when the app bounced to sign-in because the saved session was rejected. */
  sessionExpiredNotice: boolean;
  clearSessionExpiredNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<boolean>(false);

  // Keep the API client's in-memory identity in sync (fixes owner/admin actions when localStorage is empty)
  useEffect(() => {
    try {
      setMemoryAuthProfile(profile ? { id: (profile as any).id, email: (profile as any).email, role: (profile as any).role } : null);
    } catch (e) {}
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    async function initAuth() {
      // 1. Restore from the local cache first so the app opens instantly,
      // even on a slow connection. The session is re-validated below.
      let restoredFromCache = false;
      try {
        const cached = localStorage.getItem('orthodox_user_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) {
            setProfile(parsed);
            setUser({
              id: parsed.id,
              email: parsed.email,
              user_metadata: {
                full_name: parsed.full_name,
                parish: parsed.parish,
                avatar_url: parsed.avatar_url,
                role: parsed.role,
              },
            });
            setCurrentUserId(parsed.id);
            restoredFromCache = true;
            // Drop the loading screen NOW — don't make the user stare at it
            // while the server check travels over a slow network.
            setLoading(false);
          }
        }
      } catch (e) {}

      try {
        // 2. Validate the session with the Edge Cloudflare Worker, but never
        // let a slow network trap the app on the loading screen: race the
        // check against a short timeout. getSession() marks network failures
        // as `unreachable` (distinct from "session rejected"), so a timeout
        // looks exactly like an unreachable server.
        const timedOut = Symbol('timeout');
        const session: any = await Promise.race([
          authApi.getSession(),
          new Promise((resolve) => setTimeout(() => resolve(timedOut), 8000)),
        ]);
        if (cancelled) return;
        if (session !== timedOut) {
          const { user: serverUser, profile: serverProfile, unreachable } = session;
          if (serverUser && serverProfile) {
            setUser(serverUser);
            setProfile(serverProfile);
            setCurrentUserId(serverProfile.id);
            try { localStorage.setItem('orthodox_user_profile', JSON.stringify(serverProfile)); } catch (e) {}
          } else if (unreachable) {
            // The network itself failed (or the check was inconclusive):
            // keep the cached session so the app still opens offline. A
            // real 401 on any later request fires 'oc:session-expired' and
            // bounces to login by itself.
          } else if (restoredFromCache) {
            // The server positively rejected our session token
            // (expired/invalid). Drop the dead cached session NOW so the
            // user lands on the sign-in screen with a clear "session
            // expired" message — instead of roaming the app as a ghost and
            // hitting confusing errors on every write action.
            try { localStorage.removeItem('orthodox_user_profile'); } catch (e) {}
            setUser(null);
            setProfile(null);
            setCurrentUserId(null);
            setSessionExpiredNotice(true);
          } else {
            // No usable local session and the server gave us nothing:
            // show the login screen.
            setUser(null);
            setProfile(null);
            setCurrentUserId(null);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session init note:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initAuth();

    // If the server rejects our session token (expired/invalid), bounce to login.
    const onSessionExpired = () => {
      setUser(null);
      setProfile(null);
      setCurrentUserId(null);
      setSessionExpiredNotice(true);
      setIsAuthModalOpen(true);
    };
    window.addEventListener('oc:session-expired', onSessionExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('oc:session-expired', onSessionExpired);
    };
  }, []);

  const signIn = async (email: string, password?: string) => {
    try {
      const res = await authApi.signIn(email, password);
      if (res.user && res.profile) {
        setUser(res.user);
        setProfile(res.profile);
        setCurrentUserId(res.profile.id);
        localStorage.setItem('orthodox_user_profile', JSON.stringify(res.profile));
        setSessionExpiredNotice(false);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, parish: string) => {
    try {
      const res = await authApi.signUp({
        email,
        password,
        fullName,
        parish,
      });
      if (res.user && res.profile) {
        setUser(res.user);
        setProfile(res.profile);
        setCurrentUserId(res.profile.id);
        localStorage.setItem('orthodox_user_profile', JSON.stringify(res.profile));
        setSessionExpiredNotice(false);
        // Welcome ritual: the app will show the candle modal once.
        try { localStorage.setItem('oc_welcome_candle', '1'); } catch {}
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await authApi.signOut();
    } catch (e) {
      console.warn('SignOut warning:', e);
    }
    localStorage.removeItem('orthodox_user_profile');
    localStorage.removeItem('orthodox_auth_token');
    setUser(null);
    setProfile(null);
    setCurrentUserId(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return { error: new Error('No profile loaded') };

    const updated: UserProfile = { ...profile, ...updates };
    setProfile(updated);

    try {
      localStorage.setItem('orthodox_user_profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    try {
      await profilesApi.update(profile.id, updates);
    } catch (err: any) {
      console.warn('Profile API update warning:', err);
    }

    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    try {
      if (!user) {
        return { error: null };
      }
      await authApi.updatePassword(newPassword, user.id);
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        updatePassword,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        sessionExpiredNotice,
        clearSessionExpiredNotice: () => setSessionExpiredNotice(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
