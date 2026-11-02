import React from 'react';
import { X, Heart, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Donations go through Stripe only (Hany, 2026-11-01) — Zelle removed.
// One-time donation, donor chooses any amount (min $1, preset $10).
export const STRIPE_DONATE_URL = 'https://buy.stripe.com/6oU28r4dZ1hH2IRbNC8k802';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTheme();
  const ar = language === 'ar';

  if (!isOpen) return null;

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
              ? 'أرثوذكسى كونكت مجاني تماماً وسيظل كذلك. لو الخدمة دي باركتك، تقدر تساعدها تستمر بهدية — أي مبلغ بركة.'
              : 'OrthodoxConnect is completely free, and always will be. If this ministry has blessed you, you can help it keep going with a gift — any amount is a blessing.'}
          </p>
        </div>

        <a
          href={STRIPE_DONATE_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer"
        >
          <span>{ar ? 'تبرع عبر Stripe' : 'Donate with Stripe'}</span>
          <ExternalLink className="w-5 h-5" />
        </a>
        <p className="text-center text-[11px] text-stone-400 mt-3">
          {ar
            ? 'تبرع لمرة واحدة — أنت تختار المبلغ، من دولار واحد.'
            : 'One-time donation — you choose the amount, from $1.'}
        </p>

        <p className="text-center text-xs text-stone-400 mt-4">
          {ar ? 'شكراً — ربنا يباركك ✝' : 'Thank you — God bless you ✝'}
        </p>
      </div>
    </div>
  );
};
