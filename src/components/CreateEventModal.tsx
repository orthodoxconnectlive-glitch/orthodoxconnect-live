import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, MapPin, Video, Image as ImageIcon, Church, Sparkles } from 'lucide-react';
import { EventItem } from '../types';
import { saveEvent } from '../utils/events';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: EventItem) => void;
}

const PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1548678967-f1fc5d33934f?auto=format&fit=crop&q=80&w=1200',
];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const { profile } = useAuth();
  const { t, language } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00 AM');
  const [locationType, setLocationType] = useState<'physical' | 'virtual'>('physical');
  const [locationAddress, setLocationAddress] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [category, setCategory] = useState<EventItem['category']>('liturgy');
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setIsSubmitting(true);
    const created = await saveEvent({
      title: title.trim(),
      description: description.trim(),
      date,
      time,
      locationType,
      locationAddress: locationType === 'physical' ? locationAddress.trim() : undefined,
      virtualLink: locationType === 'virtual' ? virtualLink.trim() : undefined,
      category,
      parish: profile?.parish || (language === 'ar' ? 'كاتدرائية الثالوث الأقدس' : 'Holy Trinity Cathedral'),
      hostName: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Parish Member'),
      hostAvatar: profile?.avatar_url,
      hostId: profile?.id || 'me',
      imageUrl,
    });

    setIsSubmitting(false);
    onEventCreated(created);
    onClose();

    // Reset fields
    setTitle('');
    setDescription('');
    setLocationAddress('');
    setVirtualLink('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-[#fdfaf5] dark:bg-[#1c1611] border border-[#d4af37]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left rtl:text-right">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#d4af37]/20 bg-[#f1ebd7] dark:bg-[#282019] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#d4af37] text-white flex items-center justify-center shadow-md">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#5a4632] dark:text-[#f5ebd9]">
                {language === 'ar' ? 'إنشاء مناسبة رعوية جديدة' : 'Create Parish Event'}
              </h3>
              <p className="text-xs text-[#8b6b4a] dark:text-[#a89379]">
                {language === 'ar'
                  ? 'جدولة القداسات الإلهية، الأعياد، دراسات الكتاب، واللقاءات الروحية'
                  : 'Schedule Divine Liturgies, Feasts, Bible Studies, and Gatherings'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8b6b4a] dark:text-[#a89379] hover:bg-[#d4af37]/10 hover:text-[#5a4632] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
              {language === 'ar' ? 'عنوان المناسبة *' : 'Event Title *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                language === 'ar'
                  ? 'مثال: القداس الإلهي الاحتفالي وتبريك الباناجيا'
                  : 'e.g. Hierarchical Divine Liturgy & Panagia Blessing'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'التصنيف' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventItem['category'])}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] focus:outline-none focus:border-[#d4af37]"
              >
                <option value="liturgy">{language === 'ar' ? 'قداس إلهي وخدمة كنسية' : 'Divine Liturgy & Service'}</option>
                <option value="feast">{language === 'ar' ? 'عيد كنسي وسيدي كبير' : 'Great Feast Day'}</option>
                <option value="bible_study">{language === 'ar' ? 'دراسة الكتاب والآبائيات' : 'Bible Study & Patristics'}</option>
                <option value="youth">{language === 'ar' ? 'لقاء الشبيبة الأرثوذكسية' : 'Youth Fellowship'}</option>
                <option value="pilgrimage">{language === 'ar' ? 'حج ديري ورياضة روحية' : 'Pilgrimage & Retreat'}</option>
                <option value="choir">{language === 'ar' ? 'تدريب خورس المرتلين' : 'Choir Rehearsal'}</option>
                <option value="social">{language === 'ar' ? 'نشاط اجتماعي ومهرجان' : 'Parish Social & Festival'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {t('parish')}
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#5a4632] dark:text-[#f5ebd9] font-semibold">
                <Church className="w-4 h-4 text-[#d4af37]" />
                <span>{profile?.parish || (language === 'ar' ? 'كاتدرائية الثالوث الأقدس' : 'Holy Trinity Cathedral')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'التاريخ *' : 'Date *'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'الوقت' : 'Time'}
              </label>
              <input
                type="text"
                placeholder={language === 'ar' ? 'مثال: 09:30 صباحاً' : 'e.g. 09:30 AM'}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          {/* Location Type Switcher */}
          <div>
            <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
              {language === 'ar' ? 'نوع المكان' : 'Location Type'}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLocationType('physical')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  locationType === 'physical'
                    ? 'bg-[#d4af37] text-white border-[#d4af37] shadow-sm'
                    : 'bg-[#f5f2ed] dark:bg-[#282019] text-[#8b6b4a] dark:text-[#a89379] border-[#d4af37]/20 hover:border-[#d4af37]/40'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>{language === 'ar' ? 'مقر كنسي / موقع فعلي' : 'Physical Venue'}</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationType('virtual')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  locationType === 'virtual'
                    ? 'bg-[#d4af37] text-white border-[#d4af37] shadow-sm'
                    : 'bg-[#f5f2ed] dark:bg-[#282019] text-[#8b6b4a] dark:text-[#a89379] border-[#d4af37]/20 hover:border-[#d4af37]/40'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>{language === 'ar' ? 'غرفة رقمية / بث مباشر' : 'Virtual / Online Room'}</span>
              </button>
            </div>
          </div>

          {locationType === 'physical' ? (
            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'عنوان المقر' : 'Venue Address'}
              </label>
              <input
                type="text"
                placeholder={language === 'ar' ? 'مثال: قاعة كاتدرائية القديس مرقس، القاهرة' : 'e.g. Holy Trinity Cathedral Hall, 450 Harvard St, Boston'}
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
                {language === 'ar' ? 'رابط البث أو الغرفة الافتراضية' : 'Virtual Link or Stream URL'}
              </label>
              <input
                type="url"
                placeholder="https://orthodoxconnect.live/room-bible"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
              {language === 'ar' ? 'الوصف والتفاصيل' : 'Description'}
            </label>
            <textarea
              rows={3}
              placeholder={
                language === 'ar'
                  ? 'اكتب تفاصيل الخدمة، تذكار القديسين، إرشادات الصوم، أو جدول الفعالية...'
                  : 'Describe the service, feast commemoration, fasting guidelines, or schedule...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#8b6b4a] dark:text-[#c5a059] uppercase tracking-wider mb-1.5">
              {language === 'ar' ? 'رابط صورة الغلاف أو اختر نموذجاً' : 'Cover Image URL or Presets'}
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] focus:outline-none focus:border-[#d4af37] mb-2"
            />
            <div className="flex gap-2">
              {PRESET_IMAGES.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImageUrl(img)}
                  className={`h-12 flex-1 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    imageUrl === img ? 'border-[#d4af37] ring-2 ring-[#d4af37]/40' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="Preset cover" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#d4af37]/20 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#8b6b4a] dark:text-[#a89379] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#b89528] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? language === 'ar'
                    ? 'جارٍ إنشاء الفعالية...'
                    : 'Creating Event...'
                  : language === 'ar'
                  ? 'نشر الفعالية'
                  : 'Publish Event'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
