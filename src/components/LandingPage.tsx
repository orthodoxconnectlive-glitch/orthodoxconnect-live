import React, { useState } from 'react';
import {
  Cross,
  Globe,
  Radio,
  BookOpen,
  Music,
  Church,
  CalendarDays,
  Baby,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { AuthPage } from './AuthPage';

interface Feature {
  icon: React.ReactNode;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
}

export const LandingPage: React.FC = () => {
  const { language, setLanguage } = useTheme();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const ar = language === 'ar';

  const features: Feature[] = [
    {
      icon: <Radio className="w-6 h-6" />,
      titleEn: 'Live Liturgies',
      titleAr: 'قداسات بث مباشر',
      descEn: 'Watch liturgies live from churches around the world.',
      descAr: 'شاهد القداسات بث مباشر من كنائس حول العالم.',
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      titleEn: '244 Orthodox Books',
      titleAr: '٢٤٤ كتاب أرثوذكسي',
      descEn: "A great spiritual library, including Pope Shenouda's collection.",
      descAr: 'مكتبة روحية كبيرة، منها مجموعة البابا شنودة.',
    },
    {
      icon: <Music className="w-6 h-6" />,
      titleEn: 'Hymns & Sermons',
      titleAr: 'ترانيم وعظات',
      descEn: 'Hymns, sermons, and short spiritual videos.',
      descAr: 'ترانيم وعظات وفيديوهات روحية قصيرة.',
    },
    {
      icon: <Church className="w-6 h-6" />,
      titleEn: 'Church Directory',
      titleAr: 'دليل الكنائس',
      descEn: 'Find Orthodox churches near you, anywhere in the world.',
      descAr: 'اعثر على الكنائس الأرثوذكسية أينما كنت.',
    },
    {
      icon: <CalendarDays className="w-6 h-6" />,
      titleEn: 'Church Calendar',
      titleAr: 'التقويم الكنسي',
      descEn: 'Feasts, fasts, and saints, every day.',
      descAr: 'الأعياد والأصوام والقديسون كل يوم.',
    },
    {
      icon: <Baby className="w-6 h-6" />,
      titleEn: 'Kids Corner',
      titleAr: 'ركن الأطفال',
      descEn: 'Safe, joyful faith content for your children.',
      descAr: 'محتوى إيماني ممتع وآمن لأطفالك.',
    },
  ];

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  if (showAuth) {
    return <AuthPage initialMode={authMode} onBack={() => setShowAuth(false)} />;
  }

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="min-h-screen bg-(--bg-page) dark:bg-[#0f0c09] text-(--tx-strong) dark:text-[#f5ebd9] transition-colors"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-(--bg-page)/90 dark:bg-[#0f0c09]/90 backdrop-blur-md border-b border-[#1e3a8a]/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#1e3a8a] shrink-0">
              <img src="/launchericon-512x512.png" alt="OrthodoxConnect" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif-coptic font-bold text-sm uppercase tracking-wider">
              OrthodoxConnect
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(ar ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1e3a8a]/50 text-xs font-bold text-[#1e3a8a] dark:text-[#93c5fd] hover:text-(--tx-strong) transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{ar ? 'EN' : 'عربي'}</span>
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="px-4 py-1.5 rounded-full text-xs font-serif font-bold uppercase tracking-wider text-[#1e3a8a] dark:text-[#93c5fd] hover:bg-(--bg-soft) dark:hover:bg-[#282019] transition-colors cursor-pointer"
            >
              {ar ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 start-0 w-72 h-72 bg-[#1e3a8a]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 end-0 w-72 h-72 bg-[#3b82f6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center relative z-10">
          <div className="w-20 h-20 mx-auto rounded-3xl overflow-hidden border-2 border-[#1e3a8a] shadow-xl mb-6">
            <img src="/launchericon-512x512.png" alt="OrthodoxConnect" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-serif-coptic font-bold text-[clamp(1.5rem,7.8vw,1.875rem)] sm:text-4xl uppercase tracking-wide sm:tracking-wider mb-4">
            OrthodoxConnect
          </h1>
          <p className="font-serif text-xl sm:text-2xl font-bold text-black dark:text-[#e2e8f0] mb-3 leading-relaxed">
            {ar ? 'بيت واحد لكل حياتك الروحية.' : 'One home for your whole Orthodox life.'}
          </p>
          <p className="text-sm text-[#1e3a8a] dark:text-[#93c5fd] font-serif leading-relaxed max-w-xl mx-auto mb-8">
            {ar
              ? 'قداسات بث مباشر، ترانيم وعظات، ٢٤٤ كتاب أرثوذكسي، دليل الكنائس، والتقويم الكنسي — مجاني للأبد.'
              : 'Live liturgies, hymns & sermons, 244 Orthodox books, a church directory, and the church calendar — free forever.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#1e3a8a] hover:bg-[#172554] text-white font-serif font-bold text-sm uppercase tracking-wider shadow-xl transition-all cursor-pointer"
            >
              {ar ? 'انضم مجاناً' : 'Join Free'}
            </button>
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl border-2 border-[#1e3a8a] text-[#1e3a8a] dark:text-[#93c5fd] font-serif font-bold text-sm uppercase tracking-wider hover:bg-(--bg-soft) dark:hover:bg-[#282019] transition-all cursor-pointer"
            >
              {ar ? 'عندي حساب' : 'I Have an Account'}
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-[11px] font-serif text-[#1e3a8a] dark:text-[#93c5fd]">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-[#93c5fd]" />
              {ar ? 'مجاني للأبد' : 'Free forever'}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-[#93c5fd]" />
              {ar ? 'عربي وإنجليزي' : 'English & عربي'}
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-center font-serif font-bold text-lg uppercase tracking-wider mb-8 text-(--tx-strong) dark:text-[#f5ebd9]">
          {ar ? 'كل ما تحتاجه روحياً، في مكان واحد' : 'Everything your soul needs, in one place'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.titleEn}
              className="rounded-3xl bg-(--bg-card) dark:bg-[#1a140e] border border-[#1e3a8a]/40 p-6 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#1e3a8a]/10 border border-[#1e3a8a]/50 flex items-center justify-center text-[#1e3a8a] dark:text-[#93c5fd] mb-4">
                {f.icon}
              </div>
              <h3 className="font-serif font-bold text-sm mb-1.5">
                {ar ? f.titleAr : f.titleEn}
              </h3>
              <p className="text-xs font-serif text-[#1e3a8a] dark:text-[#93c5fd] leading-relaxed">
                {ar ? f.descAr : f.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 py-10 text-center">
        <div className="rounded-3xl bg-[#1e3a8a]/10 border-2 border-[#1e3a8a]/50 p-8 sm:p-10">
          <h2 className="font-serif font-bold text-xl mb-3">
            {ar ? 'عائلتك الأرثوذكسية مستنياك.' : 'Your Orthodox family is waiting.'}
          </h2>
          <p className="text-sm font-serif text-[#1e3a8a] dark:text-[#93c5fd] mb-6">
            {ar
              ? 'انضم لمئات الأقباط الأرثوذكس اللي لقوا بيتهم هنا.'
              : 'Join hundreds of Orthodox Christians who already found their home here.'}
          </p>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="px-10 py-4 rounded-2xl bg-[#1e3a8a] hover:bg-[#172554] text-white font-serif font-bold text-sm uppercase tracking-wider shadow-xl transition-all cursor-pointer"
          >
            {ar ? 'مجاني تماماً' : 'Completely Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e3a8a]/30 mt-6">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#1e3a8a] shrink-0">
              <img src="/launchericon-512x512.png" alt="OrthodoxConnect" className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] font-serif uppercase tracking-widest text-[#1e3a8a] dark:text-[#93c5fd]">
              OrthodoxConnect · Fellowship in Faith
            </span>
          </div>
          <button
            type="button"
            onClick={() => openAuth('signin')}
            className="flex items-center gap-1.5 text-xs font-serif text-[#1e3a8a] dark:text-[#93c5fd] hover:text-(--tx-strong) transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {ar ? 'تسجيل الدخول' : 'Sign in'}
          </button>
        </div>
      </footer>
    </div>
  );
};
