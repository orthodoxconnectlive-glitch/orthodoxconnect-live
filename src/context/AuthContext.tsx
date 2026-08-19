import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserProfile, UserRole } from '../types';
import { authApi, profilesApi } from '../lib/api';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function initAuth() {
      try {
        // 1. Try local cache first for instant render
        const cached = localStorage.getItem('orthodox_user_profile');
        if (cached) {
          try {
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
            }
          } catch (e) {}
        }

        // 2. Validate session with Edge Cloudflare Worker
        const { user: serverUser, profile: serverProfile } = await authApi.getSession();
        if (serverUser && serverProfile) {
          setUser(serverUser);
          setProfile(serverProfile);
          setCurrentUserId(serverProfile.id);
          localStorage.setItem('orthodox_user_profile', JSON.stringify(serverProfile));
        } else if (!cached) {
          setUser(null);
          setProfile(null);
          setCurrentUserId(null);
        }
      } catch (err) {
        console.warn('[AuthContext] Session init note:', err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const signIn = async (email: string, password?: string) => {
    try {
      const res = await authApi.signIn(email, password);
      if (res.user && res.profile) {
        setUser(res.user);
        setProfile(res.profile);
        setCurrentUserId(res.profile.id);
        localStorage.setItem('orthodox_user_profile', JSON.stringify(res.profile));
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
