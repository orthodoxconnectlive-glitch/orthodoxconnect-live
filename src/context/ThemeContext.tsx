import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, Language } from '../types';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    appName: 'OrthodoxConnect',
    tagline: 'Orthodox Fellowship & Community Network',
    feed: 'Feed',
    reels: 'Reels',
    goLive: 'Go Live',
    myNetwork: 'My Network',
    messages: 'Messages',
    calendar: 'Calendar',
    adminPanel: 'Admin Panel',
    profile: 'Profile',
    notifications: 'Notifications',
    inviteFriends: 'Invite Friends',
    searchParish: 'Search posts, saints, or parishes...',
    dailyCommemoration: 'Daily Commemoration',
    dailyScripture: 'Daily Scripture',
    fastingSeason: 'Fasting Season',
    sharePost: 'Share something with your parish fellowship...',
    post: 'Post',
    like: 'Blessing / Like',
    comment: 'Comment',
    reshare: 'Reshare',
    quote: 'Quote',
    activeChats: 'Active Chats',
    onlineNow: 'Online Now',
    editProfile: 'Edit Profile',
    signOut: 'Sign Out',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    copyLink: 'Copy Link',
    shareWhatsApp: 'Share via WhatsApp',
    referralLink: 'Referral Invite Link',
    scanQr: 'Scan QR Code to Join OrthodoxConnect',
    language: 'Language',
    themeMode: 'Theme Mode',
    ancientGold: 'Ancient Gold',
    dark: 'Dark',
    light: 'Light',
    arabic: 'العربية',
    english: 'English',
    users: 'Registered Users',
    activeSessions: 'Active Sessions',
    userDirectory: 'User Directory',
    promoteAdmin: 'Promote to Admin',
    demoteUser: 'Demote to User',
    role: 'Role',
    parish: 'Parish / Monastery',
    bio: 'Biography',
    fullName: 'Full Name',
    password: 'New Password',
    updateProfile: 'Update Profile',
    liveStreams: 'Parish Live Streams',
    joinRoom: 'Join Room',
    activeMembers: 'active members',
    blessingRequest: 'Ask for Priest Blessing',
    send: 'Send',
    typeMessage: 'Write a message...',
    allParishFeed: 'All Parish Feed',
    followingFeed: 'Following Feed',
    peopleIFollow: 'People I Follow',
    myJoinedGroups: 'My Joined Groups',
    discoverCommunity: 'Discover Community',
    parishEventsTitle: 'Parish Events & Liturgical Calendar',
    parishEventsSub: 'Divine Liturgies, Feasts, Bible Studies, Pilgrimages, and Community Gatherings',
    createParishEvent: 'Create Parish Event',
    parishEventsTab: 'Parish Events',
    orthodoxFeastsTab: 'Orthodox Feasts & Fasting Rule',
    todaysCommemoration: "TODAY'S COMMEMORATION",
    upcomingGreatFeasts: 'Upcoming Great Feasts & Fasting Rule',
    enterRoom: 'Enter Room',
    joinGroup: 'Join Group',
    joined: 'Joined',
    leaveGroup: 'Leave',
    follow: 'Follow',
    following: 'Following',
    unfollow: 'Unfollow',
    host: 'Host',
    shareStory: 'Share Story',
    parishStory: 'Parish Story',
    uploadReel: 'Upload Reel',
    startStream: 'Start Stream',
    markAllRead: 'Mark All as Read',
    clearAll: 'Clear All',
    noNotifications: 'No notifications yet',
    referralSub: 'Share parish referral link & QR code with your community.',
    saintOfTheDay: 'Saint of the Day',
    audioCall: 'Audio Call',
    videoCall: 'Video Call',
    calling: 'Calling...',
    incomingCall: 'Incoming Call',
    inCall: 'Active Call',
    muteMic: 'Mute Mic',
    unmuteMic: 'Unmute Mic',
    cameraOff: 'Camera Off',
    cameraOn: 'Camera On',
    endCall: 'End Call',
    voiceNote: 'Voice Note',
    recordingVoiceNote: 'Recording voice note...',
    attachImage: 'Attach Photo',
    attachVideo: 'Attach Video',
    recordAudio: 'Record Audio',
    createCustomGroup: 'Create New Group',
    groupName: 'Group Name',
    groupType: 'Group Category',
    groupDescription: 'Group Description',
    groupIcon: 'Group Icon Symbol',
    startGroupCall: 'Start Group Audio/Video Call',
    groupCallActive: 'Group Call in Progress',
    leaveCall: 'Leave Call',
    participants: 'Participants',
    manageGroupAdmins: 'Manage Group Admins',
    inviteToGroup: 'Invite Members to Group',
  },
  ar: {
    appName: 'أورثوذكس كونكت',
    tagline: 'شبكة التواصل والأخوة الأرثوذكسية',
    feed: 'المنشورات',
    reels: 'فيديوهات ريلز',
    goLive: 'بث مباشر',
    myNetwork: 'شبكتي وغرف الأخوة',
    messages: 'الرسائل',
    calendar: 'التقويم الكنسي',
    adminPanel: 'لوحة الإدارة',
    profile: 'الملف الشخصي',
    notifications: 'الإشعارات',
    inviteFriends: 'دعوة الأصدقاء',
    searchParish: 'ابحث في المنشورات، القديسين، أو الرعايا...',
    dailyCommemoration: 'تذكار القديسين اليومي',
    dailyScripture: 'القراءة اليومية',
    fastingSeason: 'فترة الصوم',
    sharePost: 'شارك تأملاً أو خبراً مع رعيتك...',
    post: 'نشر',
    like: 'بركة / إعجاب',
    comment: 'تعليق',
    reshare: 'إعادة مشاركة',
    quote: 'اقتباس',
    activeChats: 'المحادثات النشطة',
    onlineNow: 'متصل الآن',
    editProfile: 'تعديل الملف الشخصي',
    signOut: 'تسجيل الخروج',
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    copyLink: 'نسخ الرابط',
    shareWhatsApp: 'مشاركة عبر واتساب',
    referralLink: 'رابط الدعوة الخاص بك',
    scanQr: 'امسح رمز QR للانضمام إلى أورثوذكس كونكت',
    language: 'اللغة',
    themeMode: 'المظهر',
    ancientGold: 'النمط الذهبي القديم',
    dark: 'الداكن',
    light: 'الفياتح',
    arabic: 'العربية',
    english: 'English',
    users: 'المستخدمون المسجلون',
    activeSessions: 'الجلسات النشطة',
    userDirectory: 'دليل الأعضاء',
    promoteAdmin: 'ترقية إلى مسؤول',
    demoteUser: 'تنزيل إلى مستخدم',
    role: 'الرتبة',
    parish: 'الرعية / الدير',
    bio: 'السيرة الذاتية',
    fullName: 'الاسم الكامل',
    password: 'كلمة المرور الجديدة',
    updateProfile: 'حفظ التغييرات',
    liveStreams: 'البث المباشر للرعايا',
    joinRoom: 'الانضمام إلى الغرفة',
    activeMembers: 'أعضاء متصلين',
    blessingRequest: 'طلب بركة الكاهن',
    send: 'إرسال',
    typeMessage: 'اكتب رسالة...',
    allParishFeed: 'منشورات الرعية العامة',
    followingFeed: 'منشورات المتابَعين',
    peopleIFollow: 'الأعضاء المتابَعون',
    myJoinedGroups: 'المجموعات المنضم إليها',
    discoverCommunity: 'استكشاف المجتمع',
    parishEventsTitle: 'فعاليات الكنيسة والتقويم اللتيرجي',
    parishEventsSub: 'القداسات الإلهية، الأعياد، دراسات الكتاب المقدس، واللقاءات الكنسية',
    createParishEvent: 'إضافة فعالية كنسية',
    parishEventsTab: 'الفعاليات الكنسية',
    orthodoxFeastsTab: 'الأعياد الأرثوذكسية وقواعد الصوم',
    todaysCommemoration: 'تذكار اليوم الكنسي',
    upcomingGreatFeasts: 'الأعياد الكنسية القادمة وقواعد الصوم',
    enterRoom: 'دخول الغرفة',
    joinGroup: 'انضمام للمجموعة',
    joined: 'منضم',
    leaveGroup: 'مغادرة',
    follow: 'متابعة',
    following: 'مُتابَع',
    unfollow: 'إلغاء المتابعة',
    host: 'المستضيف',
    shareStory: 'إضافة قصة',
    parishStory: 'قصص الرعية',
    uploadReel: 'رفع فيديو ريلز',
    startStream: 'بدء البث المباشر',
    markAllRead: 'تحديد الكل كمقروء',
    clearAll: 'مسح الكل',
    noNotifications: 'لا توجد إشعارات حالياً',
    referralSub: 'شارك رابط الدعوة ورمز QR الخاص بالرعية مع مجتمعك.',
    saintOfTheDay: 'قديس اليوم',
    audioCall: 'مكالمة صوتية',
    videoCall: 'مكالمة فيديو',
    calling: 'جاري الاتصال...',
    incomingCall: 'مكالمة واردة',
    inCall: 'مكالمة نشطة',
    muteMic: 'كتم الصوت',
    unmuteMic: 'تشغيل الصوت',
    cameraOff: 'إيقاف الكاميرا',
    cameraOn: 'تشغيل الكاميرا',
    endCall: 'إنهاء المكالمة',
    voiceNote: 'رسالة صوتية',
    recordingVoiceNote: 'جاري تسجيل الرسالة الصوتية...',
    attachImage: 'إرفاق صورة',
    attachVideo: 'إرفاق فيديو',
    recordAudio: 'تسجيل صوتي',
    createCustomGroup: 'إنشاء مجموعة جديدة',
    groupName: 'اسم المجموعة',
    groupType: 'تصنيف المجموعة',
    groupDescription: 'وصف المجموعة',
    groupIcon: 'رمز المجموعة',
    startGroupCall: 'بدء مكالمة جماعية صوتية/فيديو',
    groupCallActive: 'مكالمة جماعية جارية',
    leaveCall: 'مغادرة المكالمة',
    participants: 'المشاركون',
    manageGroupAdmins: 'إدارة مسؤولي المجموعة',
    inviteToGroup: 'دعوة أعضاء للمجموعة',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('oc_theme') as ThemeMode) || 'ancient';
  });

  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('oc_lang') as Language) || 'en';
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('oc_theme', mode);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('oc_lang', lang);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-ancient', 'dark', 'light');
    if (theme === 'dark') {
      root.classList.add('dark', 'theme-dark');
    } else if (theme === 'ancient') {
      root.classList.add('theme-ancient');
    } else {
      root.classList.add('light', 'theme-light');
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
