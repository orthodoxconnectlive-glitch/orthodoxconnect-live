import React, { useState } from 'react';
import { Mail, Lock, User, Church, Cross, LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { t, language } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [parish, setParish] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
              ? 'يرجى إدخال اسمك الكامل واسم رعيتك.'
              : 'Please enter your full name and parish.'
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
    <div className="min-h-screen bg-[#eddcb9] dark:bg-[#0f0c09] text-[#3d2b18] dark:text-[#f5ebd9] flex items-center justify-center p-4 selection:bg-[#c5a059] selection:text-white transition-colors text-left rtl:text-right">
      <div className="w-full max-w-md bg-[#f6ebd6] dark:bg-[#1a140e] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#c5a059]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#a8833c]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-3 mb-8 relative z-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#c5a059]/20 border-2 border-[#c5a059] flex items-center justify-center text-[#c5a059] shadow-xl">
            <Cross className="w-8 h-8" />
          </div>
          <h1 className="font-serif-coptic font-bold text-2xl text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
            {t('appName')}
          </h1>
          <p className="text-xs font-serif text-[#7c5f3d] dark:text-[#a89379]">
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
        <div className="flex rounded-2xl bg-[#eedcb5] dark:bg-[#282019] p-1.5 mb-6 border border-[#c5a059]/40 relative z-10">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorText(null);
            }}
            className={`flex-1 py-2.5 text-xs font-serif font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[#c5a059] text-white shadow-md'
                : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] dark:hover:text-[#f5ebd9]'
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
                ? 'bg-[#c5a059] text-white shadow-md'
                : 'text-[#7c5f3d] dark:text-[#a89379] hover:text-[#3d2b18] dark:hover:text-[#f5ebd9]'
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
                <label className="block text-[#a8833c] font-bold uppercase tracking-wider text-[10px] mb-1">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#a8833c]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: يوحنا ذهبي الفم' : 'e.g. John Chrysostom'}
                    className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-[#eedcb5]/60 dark:bg-[#282019] border border-[#c5a059]/50 text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#a8833c]/60 focus:outline-none focus:border-[#c5a059] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#a8833c] font-bold uppercase tracking-wider text-[10px] mb-1">
                  {t('parish')}
                </label>
                <div className="relative">
                  <Church className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#a8833c]" />
                  <input
                    type="text"
                    required
                    value={parish}
                    onChange={(e) => setParish(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: كاتدرائية الثالوث الأقدس' : 'e.g. Holy Trinity Cathedral'}
                    className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-[#eedcb5]/60 dark:bg-[#282019] border border-[#c5a059]/50 text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#a8833c]/60 focus:outline-none focus:border-[#c5a059] transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[#a8833c] font-bold uppercase tracking-wider text-[10px] mb-1">
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#a8833c]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-[#eedcb5]/60 dark:bg-[#282019] border border-[#c5a059]/50 text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#a8833c]/60 focus:outline-none focus:border-[#c5a059] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#a8833c] font-bold uppercase tracking-wider text-[10px] mb-1">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-[#a8833c]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10 py-3 rounded-2xl bg-[#eedcb5]/60 dark:bg-[#282019] border border-[#c5a059]/50 text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#a8833c]/60 focus:outline-none focus:border-[#c5a059] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 rounded-2xl bg-[#c5a059] hover:bg-[#a8833c] text-white font-serif font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer disabled:opacity-50"
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
        <div className="mt-6 text-center text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif uppercase tracking-widest border-t border-[#c5a059]/20 pt-4">
          OrthodoxConnect · Fellowship in Faith
        </div>
      </div>
    </div>
  );
};
