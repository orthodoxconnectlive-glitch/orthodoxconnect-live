import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
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

  // Fetch or upsert user profile from Supabase profiles table
  const fetchProfile = async (userId: string, emailStr?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Supabase fetch error:', error);
      }

      if (!error && data) {
        const userEmail = (data.email || emailStr || '').toLowerCase();
        const isSuperAdmin = userEmail === 'orthodoxconnect.live@gmail.com';
        const assignedRole: UserRole = isSuperAdmin ? 'super_admin' : ((data.role as UserRole) || 'user');

        setProfile({
          id: data.id,
          email: data.email || emailStr || '',
          full_name: data.full_name || (emailStr ? emailStr.split('@')[0] : 'Parishioner'),
          parish: data.parish || 'Orthodox Church',
          bio: data.bio || 'Orthodox Christian seeking fellowship.',
          avatar_url: data.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
          role: assignedRole,
          created_at: data.created_at,
        });

        if (isSuperAdmin && data.role !== 'super_admin') {
          supabase.from('profiles').update({ role: 'super_admin' }).eq('id', data.id).then();
        }
        return;
      }

      // If profile does not exist yet in table, build default from user email/id
      const userEmail = (emailStr || '').toLowerCase();
      const isSuperAdmin = userEmail === 'orthodoxconnect.live@gmail.com';
      const defaultProf: UserProfile = {
        id: userId,
        email: emailStr || '',
        full_name: isSuperAdmin ? 'Super Admin' : (emailStr ? emailStr.split('@')[0] : 'Parishioner'),
        parish: isSuperAdmin ? 'Holy Synod Headquarters' : 'Orthodox Church',
        bio: isSuperAdmin ? 'Global Administrator & Shepherd for OrthodoxConnect.' : 'Orthodox Christian seeking fellowship and spiritual growth.',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        role: isSuperAdmin ? 'super_admin' : 'user',
      };

      setProfile(defaultProf);

      // Attempt upserting to database
      const { error: upsertErr } = await supabase.from('profiles').upsert([
        {
          id: userId,
          email: defaultProf.email,
          full_name: defaultProf.full_name,
          parish: defaultProf.parish,
          bio: defaultProf.bio,
          avatar_url: defaultProf.avatar_url,
          role: defaultProf.role,
        },
      ]);
      if (upsertErr) {
        console.error('Supabase fetch error:', upsertErr);
      }
    } catch (err) {
      console.error('Supabase fetch error:', err);
    }
  };

  useEffect(() => {
    // Check initial auth session via supabase.auth.getUser()
    supabase.auth.getUser().then(({ data: { user: currentUser }, error }) => {
      if (error) {
        console.error('Supabase fetch error:', error);
      }
      if (currentUser) {
        setUser(currentUser);
        fetchProfile(currentUser.id, currentUser.email);
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('orthodox_user_profile');
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Supabase fetch error:', err);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('orthodox_user_profile');
      } else if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id, data.user.email);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, parish: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            parish,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        const newProf: UserProfile = {
          id: data.user.id,
          email,
          full_name: fullName,
          parish,
          bio: 'Orthodox Christian seeking fellowship.',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
          role: 'user',
        };
        setProfile(newProf);

        await supabase.from('profiles').insert([
          {
            id: data.user.id,
            email,
            full_name: fullName,
            parish,
            bio: newProf.bio,
            avatar_url: newProf.avatar_url,
            role: 'user',
          },
        ]);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut warning:', e);
    }
    localStorage.removeItem('orthodox_user_profile');
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return { error: new Error('No profile loaded') };

    const updated = { ...profile, ...updates };
    setProfile(updated);

    try {
      localStorage.setItem('orthodox_user_profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    if (user && user.id) {
      try {
        const { error } = await supabase.from('profiles').upsert([
          {
            id: user.id,
            full_name: updated.full_name,
            parish: updated.parish,
            bio: updated.bio,
            avatar_url: updated.avatar_url,
            role: updated.role,
          },
        ]);
        if (error) {
          console.warn('Database sync notice:', error.message);
        }
      } catch (err: any) {
        console.warn('Profile database update warning:', err);
      }
    }

    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    try {
      if (!user) {
        // If guest user or local offline mode, simulate successful password update
        return { error: null };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
