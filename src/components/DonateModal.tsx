import React, { useState } from 'react';
import { X, Copy, Check, Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Donations go to Hany's Zelle (phone number). Zelle has no checkout link,
// so the app shows the number with a copy button — donors send from their
// own bank app, the same way churches collect Zelle offerings.
export const ZELLE_DONATE_PHONE = '571-550-1677';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTheme();
  const [copied, setCopied] = useState(false);
  const ar = language === 'ar';

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ZELLE_DONATE_PHONE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100 text-left rtl:text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer"
          aria-label={ar ? 'إغلاق' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Heart className="w-6 h-6 fill-current" />
          </div>
          <h3 className="font-serif font-bold text-xl text-amber-100">
            {ar ? 'ادعم أرثوذكسى كونكت' : 'Support OrthodoxConnect'}
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto leading-relaxed">
            {ar
              ? 'أرثوذكسى كونكت مجاني تماماً وسيظل كذلك. لو الخدمة دي باركتك، تقدر تساعدها تستمر بهدية عن طريق Zelle — أي مبلغ بركة.'
              : 'OrthodoxConnect is completely free, and always will be. If this ministry has blessed you, you can help it keep going with a gift via Zelle — any amount is a blessing.'}
          </p>
        </div>

        {/* Zelle number card */}
        <div className="p-4 bg-stone-900 border border-amber-900/40 rounded-2xl flex flex-col items-center justify-center mb-4 shadow-inner">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">
            Zelle
          </span>
          <span className="text-2xl font-mono font-bold text-amber-100 tracking-wide" dir="ltr">
            {ZELLE_DONATE_PHONE}
          </span>
          <span className="text-[11px] text-stone-400 mt-2 text-center">
            {ar
              ? 'افتح تطبيق البنك ← Zelle ← إرسال ← اكتب الرقم ده'
              : 'Open your bank app → Zelle → Send → enter this number'}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              <span>{ar ? 'تم نسخ الرقم!' : 'Number Copied!'}</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span>{ar ? 'انسخ الرقم' : 'Copy the Number'}</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-stone-400 mt-4">
          {ar ? 'شكراً — ربنا يباركك ✝' : 'Thank you — God bless you ✝'}
        </p>
      </div>
    </div>
  );
};
