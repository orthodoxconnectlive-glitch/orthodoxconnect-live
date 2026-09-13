import React, { useState, useEffect, useLayoutEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MediaProvider } from './context/MediaContext';
import { CallProvider } from './context/CallContext';
import { GroupCallProvider } from './context/GroupCallContext';
import { GroupCallModal } from './components/GroupCallModal';
import { GlobalNotificationToast } from './components/GlobalNotificationToast';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ActiveChatsPanel } from './components/ActiveChatsPanel';
import { LiturgicalBanner } from './components/LiturgicalBanner';
import { InviteModal } from './components/InviteModal';
import { EditProfileModal } from './components/EditProfileModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
// NEW: notification auto-refresh (adjust path if your service lives elsewhere)
import { loadNotifications, markNotificationAsRead } from './utils/notifications';

import { FeedView } from './views/FeedView';
// Route-based code splitting: every non-default view loads on demand,
// keeping the initial bundle small for a fast first paint.
const VideosView = lazy(() => import('./views/VideosView').then((m) => ({ default: m.VideosView })));
const LiveBroadcastView = lazy(() => import('./views/LiveBroadcastView').then((m) => ({ default: m.LiveBroadcastView })));
const GroupRoomsView = lazy(() => import('./views/GroupRoomsView').then((m) => ({ default: m.GroupRoomsView })));
const MessengerView = lazy(() => import('./views/MessengerView').then((m) => ({ default: m.MessengerView })));
const ProfileView = lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })));
import type { UserProfileData } from './views/ProfileView';
const AdminPanelView = lazy(() => import('./views/AdminPanelView').then((m) => ({ default: m.AdminPanelView })));
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })));
const ChurchesView = lazy(() => import('./views/ChurchesView').then((m) => ({ default: m.ChurchesView })));
const ChurchProfileView = lazy(() => import('./views/ChurchProfileView').then((m) => ({ default: m.ChurchProfileView })));
const MarketplaceView = lazy(() => import('./views/MarketplaceView').then((m) => ({ default: m.MarketplaceView })));
const NotificationsView = lazy(() => import('./views/NotificationsView').then((m) => ({ default: m.NotificationsView })));
const LibraryView = lazy(() => import('./views/LibraryView').then((m) => ({ default: m.LibraryView })));
import { updateSEOForView } from './utils/seo';

// Lightweight fallback shown while a lazily-loaded view chunk downloads.
const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-10 h-10 rounded-full border-4 border-(--ln-gold) border-t-transparent animate-spin" />
    <p className="text-xs text-(--tx-mute) font-serif">Loading…</p>
  </div>
);

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
  const [activeMessengerContactId, setActiveMessengerContactId] = useState<string | undefined>(undefined);
  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  // When a notification targets a specific post, we navigate to the feed and
  // ask FeedView to scroll to + highlight that post, then clear it.
  const [focusPostId, setFocusPostId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('orthodox_active_tab', currentView);
    } catch (e) {
      console.warn('LocalStorage active tab save error:', e);
    }

    // Update dynamic canonical link tag, title, and social meta
    updateSEOForView(currentView);
  }, [currentView]);

  // Check URL params for referral invite link /invite?ref=xyz
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (path.includes('/invite') || searchParams.has('ref')) {
      setIsInviteOpen(true);
    }

    // Phone-top notification tap: service worker appends ?readNotif=<id> so the
    // tapped notification is marked as read (badge clears) on app open.
    const readNotifId = searchParams.get('readNotif');
    if (readNotifId) {
      markNotificationAsRead(readNotifId).catch(() => {});
      searchParams.delete('readNotif');
      const cleanUrl = window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '') + window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  // NEW: auto-refresh notifications so likes/comments from other users appear
  // without a manual page refresh. Polls the D1-backed /api/notifications
  // endpoint; loadNotifications merges into the cache and notifies listeners
  // via the 'orthodox:notifications_updated' event.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      loadNotifications().catch((err) =>
        console.warn('[notifications] auto-refresh failed:', err)
      );
    };

    // One fetch shortly after the app becomes interactive
    const initial = setTimeout(refresh, 5000);

    // Then poll every 30s while the tab is visible
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);

    // And refresh immediately when the user comes back to the tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearTimeout(initial);
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const handleOpenMessengerWithUser = (contactId?: string) => {
    setActiveMessengerContactId(contactId);
    try {
      if (contactId) localStorage.setItem('orthodox_active_contact_id', contactId);
    } catch (e) {}
    setCurrentView('messages');
  };

  const handleSelectUser = (userData: UserProfileData) => {
    setViewedUserProfile(userData);
    setCurrentView('profile');
  };

  const handleOpenChurch = (churchId: string) => {
    setSelectedChurchId(churchId);
    setCurrentView('churchProfile');
  };

  const handleNavigate = (view: string, postId?: string) => {
    if (view === 'profile') {
      setViewedUserProfile(null); // Clicking "Profile" in nav resets to logged-in user profile
    }
    // Keep the target post only when heading to the feed; anything else clears it.
    setFocusPostId(view === 'feed' && postId ? postId : null);
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return (
          <FeedView
            onSelectUser={handleSelectUser}
            onOpenMessengerWithUser={handleOpenMessengerWithUser}
            onOpenCalendar={() => handleNavigate('calendar')}
            focusPostId={focusPostId}
            onFocusPostConsumed={() => setFocusPostId(null)}
          />
        );
      case 'videos':
      case 'reels':
        return <VideosView onSelectUser={handleSelectUser} onOpenMessengerWithUser={handleOpenMessengerWithUser} />;
      case 'library':
        return <LibraryView />;
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
      case 'churches':
        return <ChurchesView onOpenChurch={handleOpenChurch} />;
      case 'churchProfile':
        return selectedChurchId ? (
          <ChurchProfileView churchId={selectedChurchId} onBack={() => setCurrentView('churches')} />
        ) : (
          <ChurchesView onOpenChurch={handleOpenChurch} />
        );
      case 'marketplace':
        return <MarketplaceView />;
      default:
        return <FeedView onSelectUser={handleSelectUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-(--bg-page) dark:bg-[#0f0c09] text-(--tx-strong) dark:text-[#f5ebd9] font-sans selection:bg-(--ac-gold) selection:text-white transition-colors">
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
              <Suspense fallback={<ViewLoadingFallback />}>{renderView()}</Suspense>
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
          /* Dedicated View Layout */
          <div className="w-full min-h-[calc(100vh-8rem)]">
            <Suspense fallback={<ViewLoadingFallback />}>{renderView()}</Suspense>
          </div>
        )}
      </main>

      {/* Global Modals & Notifications */}
      <GlobalNotificationToast
        onNavigate={handleNavigate}
        onOpenMessengerWithUser={handleOpenMessengerWithUser}
      />
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
      <div className="min-h-screen bg-(--bg-page) dark:bg-[#0f0c09] text-(--tx-strong) dark:text-[#f5ebd9] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/20 border border-(--ln-gold) flex items-center justify-center text-(--ac-gold-tx) animate-pulse">
            <span className="font-bold text-xl">☨</span>
          </div>
          <p className="font-serif font-bold text-sm tracking-wider uppercase text-(--ac-bronze-tx)">
            Loading OrthodoxConnect...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <CallProvider>
      <GroupCallProvider>
        <AppContent />
        <GroupCallModal />
      </GroupCallProvider>
    </CallProvider>
  );
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