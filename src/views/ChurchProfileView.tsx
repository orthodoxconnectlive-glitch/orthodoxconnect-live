import React, { useState, useEffect, useRef } from 'react';
import { Church as ChurchIcon, ArrowLeft, MapPin, User, Phone, Globe, Clock, Pencil, Loader2, Check, X, Upload, Trash2, Plus, CalendarDays } from 'lucide-react';
import { churchesApi, eventsApi } from '../lib/api';
import { Church } from '../types';
import { compressImageToDataUrl } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface ChurchProfileViewProps {
  churchId: string;
  onBack: () => void;
}

const inputCls =
  'w-full p-2.5 rounded-xl bg-[#282019] border border-(--ln-gold) text-[#f5ebd9] placeholder-(--tx-ph-dark) focus:outline-none text-sm';

export const ChurchProfileView: React.FC<ChurchProfileViewProps> = ({ churchId, onBack }) => {
  const { profile, updateProfile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // weekly schedule (visible to all, managed by owner/admin)
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [showSchedForm, setShowSchedForm] = useState(false);
  const [schedDay, setSchedDay] = useState(0);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedSaving, setSchedSaving] = useState(false);

  // church events (visible to all, added by owner/admin)
  const [churchEvents, setChurchEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [evtTime, setEvtTime] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtLocation, setEvtLocation] = useState('');
  const [evtSaving, setEvtSaving] = useState(false);

  // edit form
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await churchesApi.get(churchId);
        setChurch(c);
        if (c && profile?.parish && profile.parish === c.name) setJoined(true);
      } catch (e) {
        console.warn('Church load notice:', e);
      } finally {
        setLoading(false);
      }
      try {
        const sched = await churchesApi.getSchedule(churchId);
        setSchedule(Array.isArray(sched) ? sched : []);
      } catch (e) {
        console.warn('Church schedule load notice:', e);
      } finally {
        setScheduleLoading(false);
      }
      try {
        const evts = await eventsApi.getByChurch(churchId);
        setChurchEvents(Array.isArray(evts) ? evts : []);
      } catch (e) {
        console.warn('Church events load notice:', e);
      } finally {
        setEventsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId]);

  const isOwner = !!church && !!profile?.id && church.owner_id === profile.id;
  const isAdmin = Boolean((profile as any)?.is_admin) || profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const canManage = isOwner || isAdmin;

  const DAY_NAMES = ar
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleAddScheduleItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || schedSaving) return;
    setSchedSaving(true);
    try {
      const item = await churchesApi.addScheduleItem(churchId, {
        day_of_week: schedDay,
        title: schedTitle.trim(),
        time: schedTime.trim(),
        notes: schedNotes.trim(),
      });
      setSchedule((prev) =>
        [...prev, item].sort(
          (a, b) => (a.day_of_week - b.day_of_week) || String(a.time || '').localeCompare(String(b.time || ''))
        )
      );
      setSchedTitle('');
      setSchedTime('');
      setSchedNotes('');
      setSchedDay(0);
      setShowSchedForm(false);
    } catch (err) {
      console.warn('Add schedule item failed:', err);
    } finally {
      setSchedSaving(false);
    }
  };

  const handleDeleteScheduleItem = async (itemId: string) => {
    if (!window.confirm(ar ? 'حذف هذا الموعد من الجدول؟' : 'Delete this schedule item?')) return;
    try {
      await churchesApi.deleteScheduleItem(churchId, itemId);
      setSchedule((prev) => prev.filter((s) => s.id !== itemId));
    } catch (err) {
      console.warn('Delete schedule item failed:', err);
    }
  };

  const handleAddChurchEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtDate || evtSaving) return;
    setEvtSaving(true);
    try {
      const created: any = await eventsApi.create({
        title: evtTitle.trim(),
        description: evtDesc.trim(),
        date: evtDate,
        time: evtTime.trim() || '10:00 AM',
        location_address: evtLocation.trim(),
        parish: church?.name || 'Orthodox Church',
        church_id: churchId,
      } as any);
      setChurchEvents((prev) =>
        [...prev, created].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      );
      setEvtTitle('');
      setEvtDate('');
      setEvtTime('');
      setEvtDesc('');
      setEvtLocation('');
      setShowEventForm(false);
    } catch (err) {
      console.warn('Add church event failed:', err);
    } finally {
      setEvtSaving(false);
    }
  };

  const openEdit = () => {
    if (!church) return;
    setName(church.name || '');
    setAvatar(church.avatar || '');
    setCity(church.city || '');
    setCountry(church.country || '');
    setAddress(church.address || '');
    setPriestName(church.priest_name || '');
    setPhone(church.phone || '');
    setWebsite(church.website || '');
    setServiceTimes(church.service_times || '');
    setDescription(church.description || '');
    setFormError('');
    setIsEditOpen(true);
  };

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setFormError('');
    try {
      const updated = await churchesApi.update(churchId, {
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
      });
      setChurch(updated);
      setIsEditOpen(false);
    } catch (err) {
      console.warn('Church update failed:', err);
      setFormError(ar ? 'فشل حفظ التعديلات.' : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChurch = async () => {
    if (!church || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await churchesApi.delete(church.id);
      onBack();
    } catch (e) {
      console.warn('Church delete failed:', e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSetAsParish = async () => {
    if (!church || joining) return;
    setJoining(true);
    try {
      const { error } = await updateProfile({ parish: church.name } as any);
      if (!error) setJoined(true);
    } catch (e) {
      console.warn('Set parish failed:', e);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-(--ac-gold-tx)" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="text-center py-16 bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl">
        <p className="text-sm text-(--tx-mute) font-serif mb-4">{ar ? 'الكنيسة غير موجودة.' : 'Church not found.'}</p>
        <button onClick={onBack} className="px-5 py-2 rounded-xl bg-(--ac-gold) text-white text-xs font-bold uppercase tracking-wider cursor-pointer">
          {ar ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  const infoRow = (icon: React.ReactNode, label: string, value?: string, href?: string) => {
    if (!value) return null;
    const content = (
      <span className="text-sm text-(--tx-strong) dark:text-[#f5ebd9] font-serif whitespace-pre-line">
        {value}
      </span>
    );
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-(--ln-gold)/20 last:border-0">
        <span className="text-(--ac-gold-tx) mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-(--tx-mute) font-serif font-bold mb-0.5">{label}</p>
          {href ? (
            <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="hover:underline text-(--ac-gold-tx)">
              {content}
            </a>
          ) : (
            content
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--tx-mute) hover:text-(--ac-gold-tx) cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {ar ? 'كل الكنائس' : 'All churches'}
      </button>

      {/* Header card */}
      <div className="overflow-hidden rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
        <div className="h-32 bg-gradient-to-br from-[#c5a059] via-[#8b6b4a] to-[#3d2b18] relative">
          {church.cover && <img src={church.cover} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-4 pt-0">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-(--bg-card) dark:border-[#1c1611] bg-(--bg-soft) dark:bg-[#282019] shadow-lg flex items-center justify-center">
              {church.avatar ? (
                <img src={church.avatar} alt={church.name} className="w-full h-full object-cover" />
              ) : (
                <ChurchIcon className="w-9 h-9 text-(--ac-gold-tx)" />
              )}
            </div>
            <div className="flex gap-2 pb-1">
              {isOwner && (
                <button
                  onClick={openEdit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-[11px] font-bold uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9] cursor-pointer hover:bg-(--ac-gold) hover:text-white transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {ar ? 'تعديل' : 'Edit'}
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteChurch}
                  onBlur={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow cursor-pointer disabled:opacity-60 ${
                    confirmDelete ? 'bg-red-700 text-white' : 'bg-red-900/20 text-red-400 border border-red-800/50 hover:bg-red-800 hover:text-white'
                  }`}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {confirmDelete ? (ar ? 'تأكيد الحذف؟' : 'Confirm delete?') : (ar ? 'حذف' : 'Delete')}
                </button>
              )}
              <button
                onClick={handleSetAsParish}
                disabled={joining || joined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow cursor-pointer disabled:opacity-60 ${
                  joined ? 'bg-emerald-700 text-white' : 'bg-(--ac-gold) hover:bg-(--ac-bronze) text-white'
                }`}
              >
                {joining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : joined ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ChurchIcon className="w-3.5 h-3.5" />
                )}
                {joined ? (ar ? 'رعيتي' : 'My parish') : ar ? 'اجعلها رعيتي' : 'Set as my parish'}
              </button>
            </div>
          </div>
          <h2 className="font-serif-coptic font-bold text-xl text-(--tx-strong) dark:text-[#f5ebd9]">{church.name}</h2>
          {(church.city || church.country) && (
            <p className="text-xs text-(--tx-mute) font-serif flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {[church.city, church.country].filter(Boolean).join(', ')}
            </p>
          )}
          {church.description && (
            <p className="text-sm text-(--tx-strong) dark:text-[#e8dcc4] font-serif leading-relaxed mt-3 whitespace-pre-line">
              {church.description}
            </p>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg p-4">
        {infoRow(<User className="w-4 h-4" />, ar ? 'الكاهن' : 'Priest', church.priest_name)}
        {infoRow(<MapPin className="w-4 h-4" />, ar ? 'العنوان' : 'Address', church.address)}
        {infoRow(<Phone className="w-4 h-4" />, ar ? 'هاتف' : 'Phone', church.phone, church.phone ? `tel:${church.phone}` : undefined)}
        {infoRow(<Globe className="w-4 h-4" />, ar ? 'الموقع' : 'Website', church.website, church.website)}
        {infoRow(<Clock className="w-4 h-4" />, ar ? 'مواعيد القداسات والخدمات' : 'Service times', church.service_times)}
        {!church.priest_name && !church.address && !church.phone && !church.website && !church.service_times && (
          <p className="text-xs text-(--tx-mute) font-serif text-center py-2">
            {ar ? 'لم تُضف معلومات بعد.' : 'No details added yet.'}
          </p>
        )}
      </div>

      {/* Weekly schedule card — visible to everyone */}
      <div className="rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif-coptic font-bold text-sm uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-2">
            <Clock className="w-4 h-4 text-(--ac-gold-tx)" />
            {ar ? 'الجدول الأسبوعي' : 'Weekly Schedule'}
          </h3>
          {canManage && (
            <button
              onClick={() => setShowSchedForm((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {ar ? 'إضافة موعد' : 'Add'}
            </button>
          )}
        </div>

        {canManage && showSchedForm && (
          <form onSubmit={handleAddScheduleItem} className="mb-3 p-3 rounded-2xl bg-[#282019] border border-(--ln-gold)/40 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={schedDay} onChange={(e) => setSchedDay(parseInt(e.target.value, 10))} className={inputCls}>
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <input value={schedTime} onChange={(e) => setSchedTime(e.target.value)} placeholder={ar ? 'الوقت (مثال: 8:00 ص)' : 'Time (e.g. 8:00 AM)'} className={inputCls} />
            </div>
            <input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder={ar ? 'العنوان (مثال: القداس الإلهي) *' : 'Title (e.g. Divine Liturgy) *'} className={inputCls} />
            <input value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} placeholder={ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'} className={inputCls} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowSchedForm(false)} className="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-[#a89379] hover:text-[#f5ebd9] cursor-pointer">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={schedSaving || !schedTitle.trim()} className="px-4 py-2 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 flex items-center gap-1">
                {schedSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {ar ? 'حفظ' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {scheduleLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-(--ac-gold-tx)" /></div>
        ) : schedule.length === 0 ? (
          <p className="text-xs text-(--tx-mute) font-serif text-center py-3">
            {ar ? 'لم يُنشر جدول أسبوعي بعد.' : 'No weekly schedule posted yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const items = schedule.filter((s) => Number(s.day_of_week) === d);
              if (!items.length) return null;
              return (
                <div key={d}>
                  <p className="text-[10px] uppercase tracking-widest text-(--ac-gold-tx) font-serif font-bold mb-1">{DAY_NAMES[d]}</p>
                  <div className="space-y-1.5">
                    {items.map((s) => (
                      <div key={s.id} className="flex items-start gap-2 py-1.5 border-b border-(--ln-gold)/20 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold">
                            {s.time && <span className="text-(--ac-gold-tx) font-bold">{s.time} — </span>}
                            {s.title}
                          </p>
                          {s.notes && <p className="text-xs text-(--tx-mute) font-serif">{s.notes}</p>}
                        </div>
                        {canManage && (
                          <button onClick={() => handleDeleteScheduleItem(s.id)} className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-950/40 cursor-pointer" title={ar ? 'حذف' : 'Delete'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Church events card — visible to everyone */}
      <div className="rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif-coptic font-bold text-sm uppercase tracking-wider text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-(--ac-gold-tx)" />
            {ar ? 'فعاليات الكنيسة' : 'Church Events'}
          </h3>
          {canManage && (
            <button
              onClick={() => setShowEventForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {ar ? 'إضافة فعالية' : 'Add event'}
            </button>
          )}
        </div>
        {eventsLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-(--ac-gold-tx)" /></div>
        ) : (() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const upcoming = churchEvents.filter((e) => String(e.date || '') >= todayStr);
          if (!upcoming.length) {
            return (
              <p className="text-xs text-(--tx-mute) font-serif text-center py-3">
                {ar ? 'لا توجد فعاليات قادمة.' : 'No upcoming events.'}
              </p>
            );
          }
          return (
            <div className="space-y-2">
              {upcoming.map((e) => (
                <div key={e.id} className="py-2 border-b border-(--ln-gold)/20 last:border-0">
                  <p className="text-sm text-(--tx-strong) dark:text-[#f5ebd9] font-serif font-bold">{e.title}</p>
                  <p className="text-xs text-(--tx-mute) font-serif mt-0.5">
                    {[e.date, e.time].filter(Boolean).join(' • ')}
                    {e.location_address ? ` • ${e.location_address}` : ''}
                  </p>
                  {e.description && <p className="text-xs text-(--tx-strong) dark:text-[#e8dcc4] font-serif mt-1 line-clamp-2">{e.description}</p>}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Edit modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl p-6 shadow-2xl text-[#f5ebd9]">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-(--ln-gold)/30">
              <Pencil className="w-5 h-5 text-(--ac-gold-tx)" />
              <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                {ar ? 'تعديل صفحة الكنيسة' : 'Edit church page'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs font-serif">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl border-2 border-dashed border-(--ln-gold) flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:bg-[#282019]"
                >
                  {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6 text-(--ac-gold-tx)" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                <div className="flex-1">
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'اسم الكنيسة *' : 'Church name *'}</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
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
                <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'مواعيد القداسات والخدمات' : 'Service times'}</label>
                <textarea rows={2} value={serviceTimes} onChange={(e) => setServiceTimes(e.target.value)} className={inputCls} />
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
                  disabled={saving || !name.trim()}
                  className="px-6 py-2.5 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {ar ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add event modal (owner/admin) */}
      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl p-6 shadow-2xl text-[#f5ebd9]">
            <button
              onClick={() => setShowEventForm(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-(--ln-gold)/30">
              <CalendarDays className="w-5 h-5 text-(--ac-gold-tx)" />
              <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                {ar ? 'إضافة فعالية للكنيسة' : 'Add church event'}
              </h3>
            </div>
            <form onSubmit={handleAddChurchEvent} className="space-y-3 text-xs font-serif">
              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'عنوان الفعالية *' : 'Event title *'}</label>
                <input required value={evtTitle} onChange={(e) => setEvtTitle(e.target.value)} className={inputCls} placeholder={ar ? 'مثال: دراسة الكتاب المقدس' : 'e.g. Bible Study'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'التاريخ *' : 'Date *'}</label>
                  <input required type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'الوقت' : 'Time'}</label>
                  <input value={evtTime} onChange={(e) => setEvtTime(e.target.value)} className={inputCls} placeholder="7:00 PM" />
                </div>
              </div>
              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'المكان' : 'Location'}</label>
                <input value={evtLocation} onChange={(e) => setEvtLocation(e.target.value)} className={inputCls} placeholder={ar ? 'مثال: قاعة الكنيسة' : 'e.g. Church hall'} />
              </div>
              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1">{ar ? 'الوصف' : 'Description'}</label>
                <textarea rows={3} value={evtDesc} onChange={(e) => setEvtDesc(e.target.value)} className={inputCls} />
              </div>
              <div className="pt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEventForm(false)} className="px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-[#a89379] hover:text-[#f5ebd9] cursor-pointer">
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={evtSaving || !evtTitle.trim() || !evtDate}
                  className="px-6 py-2.5 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                >
                  {evtSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {ar ? 'إضافة' : 'Add event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
