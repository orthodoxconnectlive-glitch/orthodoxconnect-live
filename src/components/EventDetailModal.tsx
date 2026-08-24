import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, MapPin, Video, Users, CheckCircle, Star, XCircle, Share2, Church } from 'lucide-react';
import { EventItem } from '../types';
import { setEventRsvp } from '../utils/events';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRsvpUpdated: (updatedEvent: EventItem) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onRsvpUpdated,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !event) return null;

  const currentRsvp = event.rsvps?.find((r) => r.userId === (profile?.id || 'me'))?.status;

  const handleRsvpChange = async (status: 'going' | 'interested' | 'not_going') => {
    const updated = await setEventRsvp(
      event.id,
      {
        id: profile?.id || 'me',
        name: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Member'),
        avatar: profile?.avatar_url,
      },
      status
    );

    if (updated) {
      onRsvpUpdated(updated);
    }
  };

  const handleShare = () => {
    const link = `${window.location.origin}/calendar?event=${event.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getCategoryLabel = (cat: string) => {
    if (language === 'ar') {
      switch (cat) {
        case 'liturgy':
          return 'قداس إلهي';
        case 'feast':
          return 'عيد سيدي';
        case 'bible_study':
          return 'دراسة الكتاب';
        case 'youth':
          return 'لقاء الشبيبة';
        case 'pilgrimage':
          return 'حج ديري';
        case 'choir':
          return 'تدريب الخورس';
        case 'social':
          return 'نشاط اجتماعي';
        default:
          return 'مناسبة كنسية';
      }
    }
    return cat.replace('_', ' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-[#fdfaf5] dark:bg-[#1c1611] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left rtl:text-right">
        {/* Cover Image Header */}
        <div className="relative h-48 sm:h-56 w-full bg-[#5a4632]">
          <img
            src={event.imageUrl || 'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=1200'}
            alt={event.title}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2c2c2c] via-[#2c2c2c]/40 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="px-3 py-1 rounded-full bg-[#d4af37] text-stone-950 font-bold text-[10px] uppercase tracking-wider shadow-md">
              {getCategoryLabel(event.category)}
            </span>
            <h2 className="font-serif font-bold text-xl sm:text-2xl mt-2 leading-tight drop-shadow-md">
              {event.title}
            </h2>
            <p className="text-xs text-amber-200/90 font-medium flex items-center gap-1.5 mt-1">
              <Church className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{event.parish}</span>
            </p>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Date, Time & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#f1ebd7] dark:bg-[#282019] border border-[#d4af37]/20 text-xs">
            <div className="flex items-center gap-2.5 text-[#5a4632] dark:text-[#f5ebd9]">
              <CalendarIcon className="w-4 h-4 text-[#d4af37] shrink-0" />
              <div>
                <p className="font-bold">{event.date}</p>
                <p className="text-[11px] text-[#8b6b4a] dark:text-[#a89379] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {event.time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5a4632] dark:text-[#f5ebd9]">
              {event.locationType === 'physical' ? (
                <MapPin className="w-4 h-4 text-[#d4af37] shrink-0" />
              ) : (
                <Video className="w-4 h-4 text-[#d4af37] shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {event.locationType === 'physical'
                    ? language === 'ar'
                      ? 'موقع فعلي'
                      : 'Physical Venue'
                    : language === 'ar'
                    ? 'لقاء افتراضي / بث'
                    : 'Virtual Gathering'}
                </p>
                {event.locationType === 'physical' ? (
                  <p className="text-[11px] text-[#8b6b4a] dark:text-[#a89379] truncate">
                    {event.locationAddress || (language === 'ar' ? 'قاعة الكنيسة' : 'Parish Hall')}
                  </p>
                ) : (
                  <a
                    href={event.virtualLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#d4af37] underline font-bold truncate block"
                  >
                    {event.virtualLink || (language === 'ar' ? 'الانضمام للغرفة الافتراضية' : 'Join Virtual Room')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* RSVP Status Bar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider">
              {language === 'ar' ? 'تأكيد حضورك' : 'Your RSVP Response'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRsvpChange('going')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'going'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-[#f5f2ed] dark:bg-[#282019] text-[#5a4632] dark:text-[#f5ebd9] border-[#d4af37]/20 hover:border-emerald-500/50'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>{language === 'ar' ? 'سأحضر' : 'Going'}</span>
              </button>

              <button
                onClick={() => handleRsvpChange('interested')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'interested'
                    ? 'bg-[#d4af37] text-white border-[#d4af37] shadow-md'
                    : 'bg-[#f5f2ed] dark:bg-[#282019] text-[#5a4632] dark:text-[#f5ebd9] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>{language === 'ar' ? 'مهتم' : 'Interested'}</span>
              </button>

              <button
                onClick={() => handleRsvpChange('not_going')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'not_going'
                    ? 'bg-stone-700 text-white border-stone-700 shadow-md'
                    : 'bg-[#f5f2ed] dark:bg-[#282019] text-[#5a4632] dark:text-[#f5ebd9] border-[#d4af37]/20 hover:border-stone-400'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>{language === 'ar' ? 'لن أحضر' : 'Not Going'}</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-serif font-bold text-sm text-[#5a4632] dark:text-[#f5ebd9] mb-1">
              {language === 'ar' ? 'عن هذه المناسبة' : 'About This Event'}
            </h4>
            <p className="text-xs text-[#4a3e31] dark:text-[#a89379] leading-relaxed">
              {event.description ||
                (language === 'ar'
                  ? 'انضم إلى مجتمع رعيتنا للعبادة والشركة الروحية والصلاة المشتركة.'
                  : 'Join our parish community for worship, spiritual fellowship, and prayer.')}
            </p>
          </div>

          {/* RSVP Attendees Preview */}
          <div className="space-y-3 pt-3 border-t border-[#d4af37]/20">
            <div className="flex items-center justify-between text-xs text-[#8b6b4a] dark:text-[#c5a059] font-bold">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#d4af37]" />
                <span>
                  {language === 'ar'
                    ? `المشاركون (${event.goingCount} حاضرون • ${event.interestedCount} مهتمون)`
                    : `Attendees (${event.goingCount} Going • ${event.interestedCount} Interested)`}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {event.rsvps && event.rsvps.length > 0 ? (
                event.rsvps.map((rsvp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f1ebd7] dark:bg-[#282019] border border-[#d4af37]/20 text-xs text-[#5a4632] dark:text-[#f5ebd9]"
                  >
                    <img
                      src={rsvp.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                      alt={rsvp.userName}
                      className="w-5 h-5 rounded-full object-cover border border-[#d4af37]/40"
                    />
                    <span className="font-semibold text-[11px]">{rsvp.userName}</span>
                    <span className="text-[10px] text-[#8b6b4a] dark:text-[#c5a059] uppercase font-bold">
                      ({rsvp.status === 'going' ? (language === 'ar' ? 'حاضر' : 'going') : rsvp.status === 'interested' ? (language === 'ar' ? 'مهتم' : 'interested') : (language === 'ar' ? 'معتذر' : 'not going')})
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#8b6b4a] dark:text-[#a89379] italic">
                  {language === 'ar'
                    ? 'كن أول من يؤكد حضوره لهذه الفعالية الرعوية المباركة!'
                    : 'Be the first to RSVP for this parish event!'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f1ebd7] dark:bg-[#282019] border-t border-[#d4af37]/20 flex items-center justify-between">
          <div className="text-[11px] text-[#8b6b4a] dark:text-[#a89379]">
            {language === 'ar' ? 'تنظيم ' : 'Hosted by '}
            <span className="font-bold text-[#5a4632] dark:text-[#f5ebd9]">{event.hostName}</span>
          </div>

          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-xl bg-white dark:bg-[#1c1611] border border-[#d4af37]/30 text-[#8b6b4a] dark:text-[#f5ebd9] hover:text-[#5a4632] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>{copied ? (language === 'ar' ? 'تم نسخ الرابط!' : 'Link Copied!') : (language === 'ar' ? 'مشاركة الفعالية' : 'Share Event')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
