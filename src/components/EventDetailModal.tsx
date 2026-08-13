import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, MapPin, Video, Users, CheckCircle, Star, XCircle, Share2, Church } from 'lucide-react';
import { EventItem } from '../types';
import { setEventRsvp } from '../utils/events';
import { useAuth } from '../context/AuthContext';

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
  const [copied, setCopied] = useState(false);

  if (!isOpen || !event) return null;

  const currentRsvp = event.rsvps?.find((r) => r.userId === (profile?.id || 'me'))?.status;

  const handleRsvpChange = async (status: 'going' | 'interested' | 'not_going') => {
    const updated = await setEventRsvp(
      event.id,
      {
        id: profile?.id || 'me',
        name: profile?.full_name || 'Orthodox Member',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-[#fdfaf5] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="px-3 py-1 rounded-full bg-[#d4af37] text-stone-950 font-bold text-[10px] uppercase tracking-wider shadow-md">
              {event.category.replace('_', ' ')}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#f1ebd7] border border-[#d4af37]/20 text-xs">
            <div className="flex items-center gap-2.5 text-[#5a4632]">
              <CalendarIcon className="w-4 h-4 text-[#d4af37] shrink-0" />
              <div>
                <p className="font-bold">{event.date}</p>
                <p className="text-[11px] text-[#8b6b4a] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {event.time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5a4632]">
              {event.locationType === 'physical' ? (
                <MapPin className="w-4 h-4 text-[#d4af37] shrink-0" />
              ) : (
                <Video className="w-4 h-4 text-[#d4af37] shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {event.locationType === 'physical' ? 'Physical Venue' : 'Virtual Gathering'}
                </p>
                {event.locationType === 'physical' ? (
                  <p className="text-[11px] text-[#8b6b4a] truncate">{event.locationAddress || 'Parish Hall'}</p>
                ) : (
                  <a
                    href={event.virtualLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#d4af37] underline font-bold truncate block"
                  >
                    {event.virtualLink || 'Join Virtual Room'}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* RSVP Status Bar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#8b6b4a] uppercase tracking-wider">
              Your RSVP Response
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRsvpChange('going')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'going'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-[#f5f2ed] text-[#5a4632] border-[#d4af37]/20 hover:border-emerald-500/50'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Going</span>
              </button>

              <button
                onClick={() => handleRsvpChange('interested')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'interested'
                    ? 'bg-[#d4af37] text-white border-[#d4af37] shadow-md'
                    : 'bg-[#f5f2ed] text-[#5a4632] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>Interested</span>
              </button>

              <button
                onClick={() => handleRsvpChange('not_going')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  currentRsvp === 'not_going'
                    ? 'bg-stone-700 text-white border-stone-700 shadow-md'
                    : 'bg-[#f5f2ed] text-[#5a4632] border-[#d4af37]/20 hover:border-stone-400'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Not Going</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-serif font-bold text-sm text-[#5a4632] mb-1">
              About This Event
            </h4>
            <p className="text-xs text-[#4a3e31] leading-relaxed">
              {event.description || 'Join our parish community for worship, spiritual fellowship, and prayer.'}
            </p>
          </div>

          {/* RSVP Attendees Preview */}
          <div className="space-y-3 pt-3 border-t border-[#d4af37]/20">
            <div className="flex items-center justify-between text-xs text-[#8b6b4a] font-bold">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#d4af37]" />
                <span>Attendees ({event.goingCount} Going • {event.interestedCount} Interested)</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {event.rsvps && event.rsvps.length > 0 ? (
                event.rsvps.map((rsvp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f1ebd7] border border-[#d4af37]/20 text-xs text-[#5a4632]"
                  >
                    <img
                      src={rsvp.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                      alt={rsvp.userName}
                      className="w-5 h-5 rounded-full object-cover border border-[#d4af37]/40"
                    />
                    <span className="font-semibold text-[11px]">{rsvp.userName}</span>
                    <span className="text-[10px] text-[#8b6b4a] uppercase font-bold">
                      ({rsvp.status})
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#8b6b4a] italic">
                  Be the first to RSVP for this parish event!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f1ebd7] border-t border-[#d4af37]/20 flex items-center justify-between">
          <div className="text-[11px] text-[#8b6b4a]">
            Hosted by <span className="font-bold text-[#5a4632]">{event.hostName}</span>
          </div>

          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-xl bg-white border border-[#d4af37]/30 text-[#8b6b4a] hover:text-[#5a4632] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
