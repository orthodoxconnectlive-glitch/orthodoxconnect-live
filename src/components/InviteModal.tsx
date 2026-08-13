import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Share2, MessageCircle, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { t } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const userId = profile?.id || 'guest-101';
  const referralUrl = `https://orthodoxconnect.live/invite?ref=${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Christ is in our Midst! Join me on OrthodoxConnect—the fellowship network for Orthodox Christians: ${referralUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleSMS = () => {
    const text = encodeURIComponent(
      `Join me on OrthodoxConnect fellowship network: ${referralUrl}`
    );
    window.open(`sms:?body=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-xl text-amber-100">
            {t('inviteFriends')}
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            {t('scanQr')}
          </p>
        </div>

        {/* QR Code Canvas */}
        <div className="p-4 bg-stone-900 border border-amber-900/40 rounded-2xl flex flex-col items-center justify-center mb-6 shadow-inner">
          <div className="p-3 bg-white rounded-xl shadow-lg">
            <QRCodeSVG value={referralUrl} size={170} level="H" includeMargin />
          </div>
          <span className="text-[11px] text-amber-300 font-mono mt-3 break-all px-2 text-center">
            {referralUrl}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCopy}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-stone-950" />
                <span>Link Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{t('copyLink')}</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleWhatsApp}
              className="py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleSMS}
              className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>SMS / Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
