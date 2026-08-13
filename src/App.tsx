import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MediaProvider } from './context/MediaContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ActiveChatsPanel } from './components/ActiveChatsPanel';
import { LiturgicalBanner } from './components/LiturgicalBanner';
import { InviteModal } from './components/InviteModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';

import { FeedView } from './views/FeedView';
import { ReelsView } from './views/ReelsView';
import { LiveBroadcastView } from './views/LiveBroadcastView';
import { GroupRoomsView } from './views/GroupRoomsView';
import { MessengerView } from './views/MessengerView';
import { ProfileView, UserProfileData } from './views/ProfileView';
import { AdminPanelView } from './views/AdminPanelView';
import { CalendarView } from './views/CalendarView';
import { NotificationsView } from './views/NotificationsView';

function AppContent() {
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('orthodox_active_tab');
      if (saved) return saved;
    } catch (e) {
      console.warn('LocalStorage active tab read error:', e);
    }
    return 'feed';
  });
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [activeMessengerContactId, setActiveMessengerContactId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('orthodox_active_contact_id') || undefined;
    } catch (e) {
      return undefined;
    }
  });
  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('orthodox_active_tab', currentView);
    } catch (e) {
      console.warn('LocalStorage active tab save error:', e);
    }
  }, [currentView]);

  // Root level single active media listener
  useEffect(() => {
    const handlePlay = (e: Event) => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('audio, video');
      allMedia.forEach((media) => {
        if (media !== e.target && !media.paused) {
          try {
            media.pause();
          } catch (err) {
            console.warn('Error pausing media element:', err);
          }
        }
      });
    };

    document.addEventListener('play', handlePlay, true);
    return () => document.removeEventListener('play', handlePlay, true);
  }, []);

  // Check URL params for referral invite link /invite?ref=xyz
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (path.includes('/invite') || searchParams.has('ref')) {
      setIsInviteOpen(true);
    }
  }, []);

  const handleOpenMessengerWithUser = (contactId?: string) => {
    setActiveMessengerContactId(contactId);
    setCurrentView('messages');
  };

  const handleSelectUser = (userData: UserProfileData) => {
    setViewedUserProfile(userData);
    setCurrentView('profile');
  };

  const handleNavigate = (view: string) => {
    if (view === 'profile') {
      setViewedUserProfile(null); // Clicking "Profile" in nav resets to logged-in user profile
    }
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return <FeedView onSelectUser={handleSelectUser} onOpenMessengerWithUser={handleOpenMessengerWithUser} />;
      case 'reels':
        return <ReelsView onSelectUser={handleSelectUser} onOpenMessengerWithUser={handleOpenMessengerWithUser} />;
      case 'live':
        return <LiveBroadcastView />;
      case 'myNetwork':
        return <GroupRoomsView onSelectUser={handleSelectUser} onOpenMessengerWithUser={handleOpenMessengerWithUser} />;
      case 'messages':
        return <MessengerView initialContactId={activeMessengerContactId} onSelectUser={handleSelectUser} />;
      case 'notifications':
        return (
          <NotificationsView
            onNavigate={handleNavigate}
            onSelectUser={handleSelectUser}
            onOpenMessengerWithUser={handleOpenMessengerWithUser}
          />
        );
      case 'profile':
        return (
          <ProfileView
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
            viewedUser={viewedUserProfile}
            onBack={() => setCurrentView('feed')}
            onOpenMessengerWithUser={handleOpenMessengerWithUser}
          />
        );
      case 'admin':
        return <AdminPanelView />;
      case 'calendar':
        return <CalendarView />;
      default:
        return <FeedView onSelectUser={handleSelectUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#eddcb9] dark:bg-[#0f0c09] text-[#3d2b18] dark:text-[#f5ebd9] font-sans selection:bg-[#c5a059] selection:text-white transition-colors">
      {/* Top Navbar */}
      <Navbar
        onOpenInvite={() => setIsInviteOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onNavigate={handleNavigate}
        currentView={currentView}
      />

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === 'feed' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
              <Sidebar
                currentView={currentView}
                onNavigate={handleNavigate}
                onOpenInvite={() => setIsInviteOpen(true)}
              />
            </div>

            {/* Main Feed Column */}
            <div className="col-span-1 lg:col-span-8 xl:col-span-6 min-w-0">
              {renderView()}
            </div>

            {/* Right Active Chats / Community Widgets Panel */}
            <div className="hidden xl:block xl:col-span-3">
              <ActiveChatsPanel
                onOpenMessenger={handleOpenMessengerWithUser}
                onSelectUser={handleSelectUser}
              />
            </div>
          </div>
        ) : (
          /* Focused Dedicated View Layout for Reels, Messages, Live, Calendar, Groups, Profile, Admin, etc. */
          <div className="w-full min-h-[calc(100vh-8rem)]">
            {renderView()}
          </div>
        )}
      </main>

      {/* Global Modals */}
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
      <AuthModal />
    </div>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eddcb9] dark:bg-[#0f0c09] text-[#3d2b18] dark:text-[#f5ebd9] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#c5a059]/20 border border-[#c5a059] flex items-center justify-center text-[#c5a059] animate-pulse">
            <span className="font-bold text-xl">☨</span>
          </div>
          <p className="font-serif font-bold text-sm tracking-wider uppercase text-[#a8833c]">
            Loading OrthodoxConnect...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppContent />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MediaProvider>
          <AppRoot />
        </MediaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

