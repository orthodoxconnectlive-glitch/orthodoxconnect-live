import React, { useState, useEffect, useRef } from 'react';
import { Church as ChurchIcon, Plus, Search, X, MapPin, User, Upload, Loader2, ChevronRight } from 'lucide-react';
import { churchesApi } from '../lib/api';
import { Church } from '../types';
import { compressImageToDataUrl } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface ChurchesViewProps {
  onOpenChurch: (id: string) => void;
}

const inputCls =
  'w-full p-2.5 rounded-xl bg-[#282019] border border-(--ln-gold) text-[#f5ebd9] placeholder-(--tx-ph-dark) focus:outline-none text-sm';

export const ChurchesView: React.FC<ChurchesViewProps> = ({ onOpenChurch }) => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [priestName, setPriestName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [serviceTimes, setServiceTimes] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = async (q = '') => {
    setLoading(true);
    try {
      setChurches(await churchesApi.list(q));
    } catch (e) {
      console.warn('Churches load notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setAvatar(await compressImageToDataUrl(file, 400, 0.72));
    } catch {
      setFormError(ar ? 'تعذر تجهيز الصورة.' : 'Could not process the image.');
    }
  };

  const resetForm = () => {
    setName(''); setAvatar(''); setCity(''); setCountry(''); setAddress('');
    setPriestName(''); setPhone(''); setWebsite(''); setServiceTimes('');
    setDescription(''); setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      const created = await churchesApi.create({
        name: name.trim(),
        avatar,
        city: city.trim(),
        country: country.trim(),
        address: address.trim(),
        priest_name: priestName.trim(),
        phone: phone.trim(),
        website: website.trim(),
        service_times: serviceTimes.trim(),
        description: description.trim(),
        owner_id: profile?.id,
      });
      resetForm();
      setIsCreateOpen(false);
      if (created?.id) onOpenChurch(created.id);
      else load(query.trim());
    } catch (err) {
      console.warn('Church create failed:', err);
      setFormError(ar ? 'فشل إنشاء صفحة الكنيسة. حاول مرة أخرى.' : 'Failed to create the church page. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ChurchIcon className="w-5 h-5 text-(--ac-gold-tx)" />
            <h2 className="font-serif-coptic font-bold text-lg text-(--tx-strong) dark:text-[#f5ebd9]">
              {ar ? 'الكنائس' : 'Churches'}
            </h2>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {ar ? 'أضف كنيستك' : 'Add your church'}
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-(--tx-mute)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? 'ابحث باسم الكنيسة أو المدينة...' : 'Search by church name or city...'}
            className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-mute) focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-(--ac-gold-tx)" />
        </div>
      ) : churches.length === 0 ? (
        <div className="text-center py-10 bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl">
          <ChurchIcon className="w-10 h-10 mx-auto mb-2 text-(--tx-mute)" />
          <p className="text-sm text-(--tx-mute) font-serif">
            {ar ? 'لا توجد كنائس بعد. كن أول من يضيف كنيسته!' : 'No churches yet. Be the first to add yours!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {churches.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenChurch(c.id)}
              className="flex items-center gap-3 p-3 rounded-2xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow hover:shadow-xl transition-all cursor-pointer text-left rtl:text-right group"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) shrink-0 flex items-center justify-center">
                {c.avatar ? (
                  <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <ChurchIcon className="w-7 h-7 text-(--ac-gold-tx)" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] truncate">
                  {c.name}
                </h3>
                {(c.city || c.country) && (
                  <p className="text-[11px] text-(--tx-mute) font-serif flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[c.city, c.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {c.priest_name && (
                  <p className="text-[11px] text-(--tx-mute) font-serif flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    {c.priest_name}
                  </p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-(--tx-mute) rtl:rotate-180 shrink-0 group-hover:text-(--ac-gold-tx) group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl p-6 shadow-2xl text-[#f5ebd9]">
            <button
              onClick={() => { setIsCreateOpen(false); resetForm(); }}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-(--ln-gold)/30">
              <ChurchIcon className="w-5 h-5 text-(--ac-gold-tx)" />
              <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                {ar ? 'أضف صفحة كنيستك' : 'Add your church page'}
              </h3>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs font-serif">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl border-2 border-dashed border-(--ln-gold) flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:bg-[#282019]"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-(--ac-gold-tx)" />
                  )}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                <div className="flex-1">
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">
                    {ar ? 'اسم الكنيسة *' : 'Church name *'}
                  </label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'مثال: كنيسة مارمرقس' : 'e.g. St Mark Church'} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'المدينة' : 'City'}</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'الدولة' : 'Country'}</label>
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'العنوان' : 'Address'}</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'اسم الكاهن' : 'Priest name'}</label>
                  <input value={priestName} onChange={(e) => setPriestName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'هاتف' : 'Phone'}</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'الموقع الإلكتروني' : 'Website'}</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={inputCls} />
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'مواعيد القداسات والخدمات' : 'Service times'}</label>
                <textarea rows={2} value={serviceTimes} onChange={(e) => setServiceTimes(e.target.value)} placeholder={ar ? 'مثال: قداس الأحد ٨ صباحاً...' : 'e.g. Sunday Liturgy 8 AM...'} className={inputCls} />
              </div>

              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'نبذة عن الكنيسة' : 'About the church'}</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>

              {formError && (
                <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl px-3 py-2">{formError}</p>
              )}

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-6 py-2.5 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {ar ? 'إنشاء الصفحة' : 'Create page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
