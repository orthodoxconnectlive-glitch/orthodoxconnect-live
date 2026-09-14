import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, User, Church, Cross, LogIn, AlertCircle, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { t, language, setLanguage } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [parish, setParish] = useState('');
  const [churchSuggestions, setChurchSuggestions] = useState<Array<{ id: string; name: string; city?: string; country?: string }>>([]);
  const [showChurchSuggestions, setShowChurchSuggestions] = useState(false);
  const parishDebounce = useRef<number | null>(null);
  const parishWrapRef = useRef<HTMLDivElement>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (parishWrapRef.current && !parishWrapRef.current.contains(e.target as Node)) {
        setShowChurchSuggestions(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, []);

  const handleParishChange = (value: string) => {
    setParish(value);
    if (parishDebounce.current) window.clearTimeout(parishDebounce.current);
    const q = value.trim();
    if (q.length < 2) {
      setChurchSuggestions([]);
      setShowChurchSuggestions(false);
      return;
    }
    parishDebounce.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/churches?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.churches) ? data.churches : [];
        setChurchSuggestions(list.slice(0, 6));
        setShowChurchSuggestions(list.length > 0);
      } catch {
        // Church directory unreachable — free text still works fine.
        setChurchSuggestions([]);
        setShowChurchSuggestions(false);
      }
    }, 350);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          setErrorText(
            error.message ||
              (language === 'ar'
                ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.'
                : 'Invalid email or password. Please try again.')
          );
        }
      } else {
        if (!fullName.trim() || !parish.trim()) {
          setErrorText(
            language === 'ar'
              ? 'يرجى إدخال الاسم الكامل واسم كنيستك.'
              : 'Please enter your full name and church name.'
          );
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName, parish);
        if (error) {
          setErrorText(
            error.message ||
              (language === 'ar'
                ? 'فشل إنشاء الحساب. يرجى التحقق من صحة البيانات.'
                : 'Sign up failed. Please check your credentials.')
          );
        }
      }
    } catch (err: any) {
      setErrorText(
        err?.message ||
          (language === 'ar'
            ? 'حدث خطأ غير متوقع أثناء تسجيل الدخول.'
            : 'An unexpected authentication error occurred.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg-page) dark:bg-[#0f0c09] text-(--tx-strong) dark:text-[#f5ebd9] flex items-center justify-center p-4 selection:bg-(--ac-gold) selection:text-white transition-colors text-left rtl:text-right">
      <div className="w-full max-w-md bg-(--bg-card) dark:bg-[#1a140e] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Language Toggle */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-(--ln-gold)/50 bg-(--bg-soft)/80 dark:bg-[#282019]/80 text-xs font-bold text-(--tx-mute) dark:text-[#a89379] hover:text-(--tx-strong) dark:hover:text-[#f5ebd9] backdrop-blur-sm transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'عربي' : 'EN'}</span>
        </button>
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-(--ac-gold)/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-(--ac-bronze)/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-3 mb-8 relative z-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-(--ac-gold)/20 border-2 border-(--ln-gold) flex items-center justify-center text-(--ac-gold-tx) shadow-xl">
            <Cross className="w-8 h-8" />
          </div>
          <h1 className="font-serif-coptic font-bold text-2xl text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider">
            {t('appName')}
          </h1>
          <p className="text-xs font-serif text-(--tx-mute) dark:text-[#a89379]">
            {mode === 'signin'
              ? language === 'ar'
                ? 'أهلاً بك مجدداً. سجّل الدخول للانضمام إلى مجتمع رعيتك الأرثوذكسي.'
                : 'Welcome back. Sign in to join your Orthodox parish community.'
              : language === 'ar'
              ? 'أنشئ حسابك للتواصل مع إخوتك وأخواتك في الإيمان الأرثوذكسي.'
              : 'Register to connect with your Orthodox brothers and sisters.'}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-2xl bg-(--bg-soft) dark:bg-[#282019] p-1.5 mb-6 border border-(--ln-gold)/40 relative z-10">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorText(null);
            }}
            className={`flex-1 py-2.5 text-xs font-serif font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-(--ac-gold) text-white shadow-md'
                : 'text-(--tx-mute) dark:text-[#a89379] hover:text-(--tx-strong) dark:hover:text-[#f5ebd9]'
            }`}
          >
            {t('signIn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorText(null);
            }}
            className={`flex-1 py-2.5 text-xs font-serif font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-(--ac-gold) text-white shadow-md'
                : 'text-(--tx-mute) dark:text-[#a89379] hover:text-(--tx-strong) dark:hover:text-[#f5ebd9]'
            }`}
          >
            {t('signUp')}
          </button>
        </div>

        {/* Error Alert */}
        {errorText && (
          <div className="p-3.5 rounded-2xl mb-6 bg-red-900/20 border border-red-500/40 text-red-700 dark:text-red-300 text-xs font-serif font-semibold flex items-center gap-2.5 relative z-10">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-serif relative z-10">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-(--ac-bronze-tx) font-bold uppercase tracking-wider text-[10px] mb-1">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-(--ac-bronze-tx)" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: يوحنا ذهبي الفم' : 'e.g. John Chrysostom'}
                    className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-(--bg-soft)/60 dark:bg-[#282019] border border-(--ln-gold)/50 text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--ac-bronze-tx)/60 focus:outline-none focus:border-(--ln-gold) transition-colors"
                  />
                </div>
              </div>

              <div ref={parishWrapRef}>
                <label className="block text-(--ac-bronze-tx) font-bold uppercase tracking-wider text-[10px] mb-1">
                  {t('parish')}
                </label>
                <div className="relative">
                  <Church className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-(--ac-bronze-tx)" />
                  <input
                    type="text"
                    required
                    value={parish}
                    onChange={(e) => handleParishChange(e.target.value)}
                    onFocus={() => { if (churchSuggestions.length > 0) setShowChurchSuggestions(true); }}
                    placeholder={language === 'ar' ? 'مثال: كنيسة السيدة العذراء مريم' : 'e.g. St. Mary Church'}
                    autoComplete="off"
                    className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-(--bg-soft)/60 dark:bg-[#282019] border border-(--ln-gold)/50 text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--ac-bronze-tx)/60 focus:outline-none focus:border-(--ln-gold) transition-colors"
                  />
                  {showChurchSuggestions && churchSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-(--ln-gold)/50 bg-(--bg-card) dark:bg-[#1a140e] shadow-2xl overflow-hidden z-30 max-h-56 overflow-y-auto">
                      {churchSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setParish(c.name);
                            setShowChurchSuggestions(false);
                            setChurchSuggestions([]);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-start hover:bg-(--bg-soft) dark:hover:bg-[#282019] transition-colors cursor-pointer"
                        >
                          <Church className="w-4 h-4 shrink-0 text-(--ac-gold-tx)" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-bold text-(--tx-strong) dark:text-[#f5ebd9] truncate">{c.name}</span>
                            {(c.city || c.country) && (
                              <span className="block text-[10px] text-(--tx-mute) dark:text-[#a89379] truncate">
                                {[c.city, c.country].filter(Boolean).join('، ')}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-(--tx-mute) dark:text-[#a89379]">
                  {language === 'ar'
                    ? 'ابدأ الكتابة واختر كنيستك من القائمة، أو اكتب اسمها بنفسك.'
                    : 'Start typing and pick your church from the list, or just type its name.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-(--ac-bronze-tx) font-bold uppercase tracking-wider text-[10px] mb-1">
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-(--ac-bronze-tx)" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-(--bg-soft)/60 dark:bg-[#282019] border border-(--ln-gold)/50 text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--ac-bronze-tx)/60 focus:outline-none focus:border-(--ln-gold) transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-(--ac-bronze-tx) font-bold uppercase tracking-wider text-[10px] mb-1">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-(--ac-bronze-tx)" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-(--bg-soft)/60 dark:bg-[#282019] border border-(--ln-gold)/50 text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--ac-bronze-tx)/60 focus:outline-none focus:border-(--ln-gold) transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 rounded-2xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-spin text-white" />
            ) : (
              <LogIn className="w-4 h-4 rtl:rotate-180" />
            )}
            <span>
              {loading
                ? language === 'ar'
                  ? 'جارٍ التحقق...'
                  : 'Authenticating...'
                : mode === 'signin'
                ? t('signIn')
                : t('signUp')}
            </span>
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 text-center text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif uppercase tracking-widest border-t border-(--ln-gold)/20 pt-4">
          OrthodoxConnect · Fellowship in Faith
        </div>
      </div>
    </div>
  );
};
