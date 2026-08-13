import React, { useState } from 'react';
import { X, Mail, Lock, User, Church, Cross, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, signIn, signUp } = useAuth();
  const { t } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [parish, setParish] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorText(error.message || 'Invalid login credentials');
      } else {
        closeAuthModal();
      }
    } else {
      if (!fullName || !parish) {
        setErrorText('Please fill in your full name and parish name.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, parish);
      if (error) {
        setErrorText(error.message || 'Sign up failed');
      } else {
        closeAuthModal();
      }
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg">
            <Cross className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-xl text-amber-100">
            {t('appName')}
          </h3>
          <p className="text-xs text-stone-400">
            {mode === 'signin'
              ? 'Sign in to connect with your Orthodox community'
              : 'Create your account to join OrthodoxConnect'}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="flex rounded-xl bg-stone-900 p-1 mb-6 border border-amber-900/30">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'signin' ? 'bg-amber-600 text-stone-950 shadow-md' : 'text-stone-400 hover:text-amber-200'
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
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              mode === 'signup' ? 'bg-amber-600 text-stone-950 shadow-md' : 'text-stone-400 hover:text-amber-200'
            }`}
          >
            {t('signUp')}
          </button>
        </div>

        {errorText && (
          <div className="p-3 rounded-xl mb-4 bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-amber-300 font-semibold mb-1">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Chrysostom / Maria Markos"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-amber-300 font-semibold mb-1">
                  {t('parish')}
                </label>
                <div className="relative">
                  <Church className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={parish}
                    onChange={(e) => setParish(e.target.value)}
                    placeholder="e.g. St. George Antiochian Church"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-amber-300 font-semibold mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orthodox@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-amber-300 font-semibold mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-900 border border-amber-900/30 text-amber-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>
              {loading
                ? 'Processing...'
                : mode === 'signin'
                ? t('signIn')
                : t('signUp')}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
