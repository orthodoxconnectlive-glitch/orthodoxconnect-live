import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Check } from 'lucide-react';

type ThemeId = 'facebook' | 'ancient' | 'dark' | 'light';

const THEMES: { id: ThemeId; nameKey: string; bg: string; card: string; text: string; accent: string }[] = [
  { id: 'facebook', nameKey: 'facebookMode', bg: '#F0F2F5', card: '#FFFFFF', text: '#050505', accent: '#1877F2' },
  { id: 'ancient', nameKey: 'ancientGold', bg: '#c8a76f', card: '#dfc795', text: '#2a1c0d', accent: '#8a6a34' },
  { id: 'dark', nameKey: 'dark', bg: '#0f0c09', card: '#1c1611', text: '#f5ebd9', accent: '#c5a059' },
  { id: 'light', nameKey: 'light', bg: '#f5f4f1', card: '#ffffff', text: '#292524', accent: '#c5a059' },
];

export default function ThemePickerModal({ onDone }: { onDone: () => void }) {
  const { theme, setTheme, setLanguage, t, language } = useTheme();
  const ar = language === 'ar';
  const [selected, setSelected] = useState<ThemeId>((theme as ThemeId) || 'facebook');

  const choose = (id: ThemeId) => {
    setSelected(id);
    setTheme(id);
  };

  const confirm = () => {
    setTheme(selected);
    try {
      localStorage.setItem('oc_theme_chosen', '1');
    } catch {}
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-[#fffdf8] p-6 sm:p-8 text-center shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setLanguage('en')}
            className={`px-4 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              !ar ? 'bg-[#b45309] text-white shadow-sm' : 'bg-black/5 text-[#7a6a4d] hover:bg-black/10'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={`px-4 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              ar ? 'bg-[#b45309] text-white shadow-sm' : 'bg-black/5 text-[#7a6a4d] hover:bg-black/10'
            }`}
          >
            عربي
          </button>
        </div>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#c5a059]/20 border border-[#c5a059]/40 flex items-center justify-center text-[#b45309] mb-3">
          <span className="font-bold text-2xl">☨</span>
        </div>
        <h2 className="font-serif font-bold text-2xl text-[#2a1c0d] mb-1">
          {ar ? 'اختر مظهرك' : 'Choose your look'}
        </h2>
        <p className="text-[#7a6a4d] text-sm mb-6">
          {ar
            ? 'اختر الشكل اللي يعجبك. تقدر تغيّره في أي وقت من الإعدادات.'
            : 'Pick the style you love. You can change it anytime in settings.'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {THEMES.map((th) => {
            const active = selected === th.id;
            return (
              <button
                key={th.id}
                onClick={() => choose(th.id)}
                className={`relative rounded-2xl overflow-hidden text-left cursor-pointer transition-all ${
                  active ? 'ring-2 ring-[#b45309] ring-offset-2 ring-offset-[#fffdf8]' : 'ring-1 ring-black/10'
                }`}
              >
                {/* mini preview */}
                <div className="p-3" style={{ background: th.bg }}>
                  <div className="rounded-lg p-2 mb-2" style={{ background: th.card }}>
                    <div className="h-2 rounded-full mb-1.5" style={{ background: th.text, opacity: 0.85, width: '80%' }} />
                    <div className="h-2 rounded-full" style={{ background: th.text, opacity: 0.4, width: '55%' }} />
                  </div>
                  <div
                    className="h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: th.accent }}
                  >
                    ☨
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-white">
                  <span className="text-sm font-semibold text-[#2a1c0d]">{t(th.nameKey)}</span>
                  {active && (
                    <span className="w-5 h-5 rounded-full bg-[#b45309] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={confirm}
          className="w-full py-3 rounded-2xl bg-[#b45309] hover:bg-[#9a4a08] text-white font-serif font-bold text-base transition-colors cursor-pointer"
        >
          {ar ? 'ابدأ' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
