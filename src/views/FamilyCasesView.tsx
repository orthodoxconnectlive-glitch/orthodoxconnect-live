import React, { useState, useEffect } from 'react';
import {
  Lock, Plus, ChevronLeft, ShieldAlert, Phone, Eye, EyeOff, Send, CheckCircle2,
  Clock, HeartHandshake, Loader2, Image as ImageIcon, User, Users,
} from 'lucide-react';
import { familyCasesApi } from '../lib/api';
import { FamilyCase, FamilyCaseEntry, FamilyCounselor } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ClergyBadge } from '../components/ClergyBadge';

const inputCls =
  'w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-ph) focus:outline-none text-sm';

const STATUS_ORDER: Array<FamilyCase['status']> = ['open', 'in_progress', 'resolved'];

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

// Family Cases (2026-11-13): private husband/wife dispute cases for the
// church. Privacy is enforced server-side — the client only ever shows what
// the server returns for the signed-in user. Nothing here appears in the
// feed, search, or notifications. Phone numbers arrive masked; the full
// number is fetched only when a case party taps "Show".
export const FamilyCasesView: React.FC = () => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const myId = (profile as any)?.id as string | undefined;
  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  const [cases, setCases] = useState<FamilyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ c: FamilyCase; entries: FamilyCaseEntry[]; my_role: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [counselors, setCounselors] = useState<FamilyCounselor[]>([]);
  const [phones, setPhones] = useState<{ husband_phone: string; wife_phone: string } | null>(null);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [formError, setFormError] = useState('');

  // new-case form
  const [ncTitle, setNcTitle] = useState('');
  const [ncMyRole, setNcMyRole] = useState<'husband' | 'wife'>('wife');
  const [ncSpouseName, setNcSpouseName] = useState('');
  const [ncSpousePhone, setNcSpousePhone] = useState('');
  const [ncMyPhone, setNcMyPhone] = useState('');
  const [ncCounselorId, setNcCounselorId] = useState('');
  const [ncFirstNote, setNcFirstNote] = useState('');
  const [ncPhotoUrl, setNcPhotoUrl] = useState('');
  const [ncBusy, setNcBusy] = useState(false);

  // note form
  const [noteBody, setNoteBody] = useState('');
  const [notePhoto, setNotePhoto] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  // manager panel
  const [assignCounselorId, setAssignCounselorId] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkRole, setLinkRole] = useState<'husband' | 'wife'>('husband');
  const [manageBusy, setManageBusy] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    try {
      setCases(await familyCasesApi.list());
    } catch (e) {
      console.warn('Family cases load notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
    familyCasesApi.counselors().then(setCounselors).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCase = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setPhones(null);
    setShowManage(false);
    setFormError('');
    setDetailLoading(true);
    try {
      const d = await familyCasesApi.get(id);
      setDetail(d);
    } catch (e) {
      console.warn('Family case load notice:', e);
      setFormError(ar ? 'تعذر فتح القضية.' : 'Could not open this case.');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id: string) => {
    try {
      const d = await familyCasesApi.get(id);
      setDetail(d);
      setCases((prev) => prev.map((c) => (c.id === id ? d.c : c)));
    } catch (e) {
      console.warn('Family case refresh notice:', e);
    }
  };

  const statusLabel = (s: FamilyCase['status']) =>
    s === 'open' ? (ar ? 'مفتوحة' : 'Open') : s === 'in_progress' ? (ar ? 'قيد المعالجة' : 'In progress') : (ar ? 'تم الحل' : 'Resolved');

  const roleLabel = (r: string) =>
    r === 'husband' ? (ar ? 'الزوج' : 'Husband') : r === 'wife' ? (ar ? 'الزوجة' : 'Wife') : r === 'counselor' ? (ar ? 'الكاهن' : 'Priest') : (ar ? 'الإدارة' : 'Admin');

  const isManager = !!detail && (detail.my_role === 'counselor' || detail.my_role === 'admin');
  const counselorRole = detail?.c?.counselor_id ? counselors.find((x) => x.id === detail.c.counselor_id)?.role : undefined;

  const submitNewCase = async () => {
    setFormError('');
    if (!ncTitle.trim()) { setFormError(ar ? 'اكتب عنواناً للقضية.' : 'Please write a title for the case.'); return; }
    if (!ncSpouseName.trim()) { setFormError(ar ? 'اكتب اسم زوجك / زوجتك.' : 'Please write your spouse’s name.'); return; }
    setNcBusy(true);
    try {
      const created = await familyCasesApi.create({
        title: ncTitle.trim(),
        my_role: ncMyRole,
        spouse_name: ncSpouseName.trim(),
        spouse_phone: ncSpousePhone.trim() || undefined,
        my_phone: ncMyPhone.trim() || undefined,
        counselor_id: ncCounselorId || undefined,
        first_note: ncFirstNote.trim() || undefined,
        photo_url: ncPhotoUrl.trim() || undefined,
      });
      setNcTitle(''); setNcSpouseName(''); setNcSpousePhone(''); setNcMyPhone(''); setNcCounselorId(''); setNcFirstNote(''); setNcPhotoUrl('');
      setShowNewCase(false);
      await loadCases();
      await openCase(created.id);
    } catch (e: any) {
      setFormError(e?.message || (ar ? 'تعذر فتح القضية. حاول مرة أخرى.' : 'Could not open the case. Please try again.'));
    } finally {
      setNcBusy(false);
    }
  };

  const submitNote = async () => {
    if (!detail) return;
    setFormError('');
    if (!noteBody.trim() && !notePhoto.trim()) { setFormError(ar ? 'اكتب ملاحظة أو أرفق صورة.' : 'Write a note or attach a photo.'); return; }
    setNoteBusy(true);
    try {
      await familyCasesApi.addEntry(detail.c.id, { body: noteBody.trim() || undefined, photo_url: notePhoto.trim() || undefined });
      setNoteBody(''); setNotePhoto('');
      await refreshDetail(detail.c.id);
    } catch (e: any) {
      setFormError(e?.message || (ar ? 'تعذر إضافة الملاحظة.' : 'Could not add the note.'));
    } finally {
      setNoteBusy(false);
    }
  };

  const revealPhones = async () => {
    if (!detail) return;
    setPhonesLoading(true);
    try {
      setPhones(await familyCasesApi.revealPhones(detail.c.id));
    } catch (e) {
      console.warn('Reveal phones notice:', e);
    } finally {
      setPhonesLoading(false);
    }
  };

  const doAssign = async () => {
    if (!detail || !assignCounselorId) return;
    setManageBusy(true);
    setFormError('');
    try {
      const updated = await familyCasesApi.assign(detail.c.id, { counselor_id: assignCounselorId });
      setDetail((d) => (d ? { ...d, c: updated } : d));
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setAssignCounselorId('');
    } catch (e: any) {
      setFormError(e?.message || (ar ? 'تعذر تعيين الكاهن.' : 'Could not assign the counselor.'));
    } finally {
      setManageBusy(false);
    }
  };

  const doLinkSpouse = async () => {
    if (!detail || !linkEmail.trim()) return;
    setManageBusy(true);
    setFormError('');
    try {
      const updated = await familyCasesApi.assign(detail.c.id, { spouse_email: linkEmail.trim(), spouse_role: linkRole });
      setDetail((d) => (d ? { ...d, c: updated } : d));
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setLinkEmail('');
    } catch (e: any) {
      setFormError(e?.message || (ar ? 'تعذر ربط حساب الزوج/الزوجة.' : 'Could not link the spouse account.'));
    } finally {
      setManageBusy(false);
    }
  };

  const doSetStatus = async (status: 'open' | 'in_progress' | 'resolved') => {
    if (!detail) return;
    setManageBusy(true);
    setFormError('');
    try {
      const updated = await familyCasesApi.setStatus(detail.c.id, status);
      setDetail((d) => (d ? { ...d, c: updated } : d));
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setFormError(e?.message || (ar ? 'تعذر تغيير الحالة.' : 'Could not change the status.'));
    } finally {
      setManageBusy(false);
    }
  };

  const statusPill =
    'px-2.5 py-1 rounded-full text-[11px] font-black shrink-0';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-2">
            <HeartHandshake className="w-7 h-7 text-amber-600 dark:text-amber-300 shrink-0" />
            {ar ? 'قضايا الأسرة' : 'Family Cases'}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-(--tx-ph) mt-1 flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {ar
              ? 'خصوصية كاملة — لا يرى القضية إلا أنت وزوجك والكاهن المسؤول. لا تظهر القضايا في المنشورات أو البحث أو الإشعارات.'
              : 'Private by design — only you, your spouse, and your priest can see a case. Nothing here appears in the feed, search, or notifications.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-black hover:bg-red-100 transition-colors cursor-pointer"
        >
          <ShieldAlert className="w-4 h-4" />
          {ar ? 'أحتاج مساعدة الآن' : 'I need help now'}
        </button>
      </div>

      {/* Help panel — safety resources only; no other numbers are invented. */}
      {showHelp && (
        <div className="rounded-3xl border-2 border-red-300 bg-red-50 dark:bg-red-950/40 p-4 sm:p-5 space-y-2">
          <p className="font-black text-red-800 dark:text-red-200 text-sm">
            {ar ? 'إذا كنت في خطر، اطلب المساعدة فوراً.' : 'If you are in danger, get help right away.'}
          </p>
          <p className="text-xs font-medium text-red-900/80 dark:text-red-100/80 leading-relaxed">
            {ar ? 'إذا كنت في خطر فوري، اتصل بخدمات الطوارئ المحلية.' : 'If you are in immediate danger, contact your local emergency services.'}
          </p>
          <p className="text-xs font-bold text-red-900 dark:text-red-100">
            {ar ? 'الخط الساخن الوطني الأمريكي للعنف الأسري: ' : 'US National Domestic Violence Hotline: '}
            <a href="tel:18007997233" className="underline font-black">1-800-799-7233</a>
          </p>
        </div>
      )}

      {formError && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-2.5 text-xs font-bold">
          {formError}
        </div>
      )}

      {/* ---------- CASE DETAIL ---------- */}
      {selectedId && detail?.c ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => { setSelectedId(null); setDetail(null); setPhones(null); }}
            className="flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            {ar ? 'قضاياي' : 'My cases'}
          </button>

          <div className="rounded-3xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) shadow-sm p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-black text-(--tx-strong) dark:text-[#f5ebd9] leading-snug">{detail.c.title}</h2>
              <span className={`${statusPill} ${detail.c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : detail.c.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'}`}>
                {statusLabel(detail.c.status)}
              </span>
            </div>

            {/* Status stepper */}
            <div className="flex items-center gap-1.5">
              {STATUS_ORDER.map((s, i) => {
                const reached = STATUS_ORDER.indexOf(detail.c.status) >= i;
                return (
                  <React.Fragment key={s}>
                    <div className={`flex items-center gap-1.5 ${reached ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${reached ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                        {reached ? '✓' : i + 1}
                      </span>
                      <span className="text-[11px] font-black">{statusLabel(s)}</span>
                    </div>
                    {i < STATUS_ORDER.length - 1 && <div className={`flex-1 h-0.5 rounded ${STATUS_ORDER.indexOf(detail.c.status) > i ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-(--bg-soft)/60 dark:bg-black/20 border border-(--ln-gold)/60 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-(--tx-ph) flex items-center gap-1"><User className="w-3.5 h-3.5" />{ar ? 'الزوج' : 'Husband'}</p>
                <p className="font-black text-sm text-(--tx-strong) dark:text-[#f5ebd9] mt-1 truncate">{detail.c.husband_name || '—'}</p>
                <p className="text-xs font-bold text-(--tx-ph) mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {phones ? (phones.husband_phone || '—') : (detail.c.husband_phone || '—')}
                </p>
              </div>
              <div className="rounded-2xl bg-(--bg-soft)/60 dark:bg-black/20 border border-(--ln-gold)/60 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-(--tx-ph) flex items-center gap-1"><User className="w-3.5 h-3.5" />{ar ? 'الزوجة' : 'Wife'}</p>
                <p className="font-black text-sm text-(--tx-strong) dark:text-[#f5ebd9] mt-1 truncate">{detail.c.wife_name || '—'}</p>
                <p className="text-xs font-bold text-(--tx-ph) mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {phones ? (phones.wife_phone || '—') : (detail.c.wife_phone || '—')}
                </p>
              </div>
              <div className="rounded-2xl bg-(--bg-soft)/60 dark:bg-black/20 border border-(--ln-gold)/60 p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-(--tx-ph) flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ar ? 'الكاهن المسؤول' : 'Priest / Counselor'}</p>
                <p className="font-black text-sm text-(--tx-strong) dark:text-[#f5ebd9] mt-1 truncate flex items-center gap-1">
                  {detail.c.counselor_name || (ar ? 'لم يُعيَّن بعد' : 'Not assigned yet')}
                  {counselorRole && <ClergyBadge role={counselorRole} />}
                </p>
                <p className="text-xs font-bold text-(--tx-ph) mt-0.5">{detail.c.counselor_id ? (ar ? 'يتابع القضية' : 'Following this case') : (ar ? 'بانتظار التعيين' : 'Waiting to be assigned')}</p>
              </div>
            </div>

            {/* Phone reveal — full numbers only reach case parties, on tap. */}
            {!phones && (
              <button
                type="button"
                onClick={revealPhones}
                disabled={phonesLoading}
                className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50 cursor-pointer"
              >
                {phonesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                {ar ? 'إظهار أرقام الهواتف' : 'Show phone numbers'}
              </button>
            )}
            {phones && (
              <button
                type="button"
                onClick={() => setPhones(null)}
                className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                {ar ? 'إخفاء أرقام الهواتف' : 'Hide phone numbers'}
              </button>
            )}

            {/* Manager panel — counselor / admin only */}
            {isManager && (
              <div className="rounded-2xl border-2 border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowManage((v) => !v)}
                  className="text-xs font-black text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
                >
                  {ar ? 'إدارة القضية (للكاهن / الإدارة)' : 'Manage case (priest / admin)'}
                </button>
                {showManage && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select value={assignCounselorId} onChange={(e) => setAssignCounselorId(e.target.value)} className={inputCls}>
                        <option value="">{ar ? 'اختر كاهناً / مرشداً…' : 'Choose a priest / counselor…'}</option>
                        {counselors.map((c) => (
                          <option key={c.id} value={c.id}>{c.full_name} ({c.role})</option>
                        ))}
                      </select>
                      <button type="button" onClick={doAssign} disabled={manageBusy || !assignCounselorId} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer shrink-0">
                        {ar ? 'تعيين' : 'Assign'}
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder={ar ? 'بريد الزوج/الزوجة لربط حسابه' : 'Spouse email to link their account'} className={inputCls} />
                      <select value={linkRole} onChange={(e) => setLinkRole(e.target.value as 'husband' | 'wife')} className={`${inputCls} sm:max-w-[140px]`}>
                        <option value="husband">{ar ? 'الزوج' : 'Husband'}</option>
                        <option value="wife">{ar ? 'الزوجة' : 'Wife'}</option>
                      </select>
                      <button type="button" onClick={doLinkSpouse} disabled={manageBusy || !linkEmail.trim()} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer shrink-0">
                        {ar ? 'ربط' : 'Link'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.c.status !== 'in_progress' && (
                        <button type="button" onClick={() => doSetStatus('in_progress')} disabled={manageBusy} className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer">
                          {ar ? 'بدء المعالجة' : 'Mark in progress'}
                        </button>
                      )}
                      {detail.c.status !== 'resolved' && (
                        <button type="button" onClick={() => doSetStatus('resolved')} disabled={manageBusy} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer">
                          {ar ? 'تم الحل' : 'Mark resolved'}
                        </button>
                      )}
                      {detail.c.status !== 'open' && (
                        <button type="button" onClick={() => doSetStatus('open')} disabled={manageBusy} className="px-3 py-2 rounded-xl bg-slate-500 hover:bg-slate-600 text-white text-xs font-black disabled:opacity-50 cursor-pointer">
                          {ar ? 'إعادة فتح' : 'Reopen'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shared timeline */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                {ar ? 'ملاحظات القضية' : 'Case notes'}
              </h3>
              {detail.entries.length === 0 && (
                <p className="text-xs font-medium text-(--tx-ph)">{ar ? 'لا توجد ملاحظات بعد. ابدأ بكتابة أول ملاحظة.' : 'No notes yet. Write the first note below.'}</p>
              )}
              {detail.entries.map((e) => {
                const mine = myId && e.author_id === myId;
                return (
                  <div key={e.id} className={`rounded-2xl border p-3 ${mine ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20' : 'border-(--ln-gold)/60 bg-(--bg-soft)/40 dark:bg-black/20'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-(--tx-strong) dark:text-[#f5ebd9]">
                        {mine ? (ar ? 'أنت' : 'You') : (e.author_name || roleLabel(e.author_role))}
                        <span className="font-bold text-(--tx-ph)"> · {roleLabel(e.author_role)}</span>
                      </p>
                      <span className="text-[11px] font-bold text-(--tx-ph) shrink-0">{fmtDate(e.created_at)}</span>
                    </div>
                    {e.body && <p className="text-sm font-medium text-(--tx-strong) dark:text-[#f5ebd9] mt-1.5 whitespace-pre-wrap leading-relaxed">{e.body}</p>}
                    {e.photo_url && (
                      <img
                        src={e.photo_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 rounded-xl max-h-64 w-auto border border-(--ln-gold)/60"
                        onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add a note */}
            <div className="space-y-2 pt-1">
              <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder={ar ? 'اكتب ملاحظتك هنا… (يراها الطرفان والكاهن فقط)' : 'Write your note here… (only the spouses and the priest can see it)'} className={inputCls} />
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--tx-ph) pointer-events-none" />
                  <input value={notePhoto} onChange={(e) => setNotePhoto(e.target.value)} placeholder="https://… .jpg / .png" className={`${inputCls} pl-9`} />
                </div>
                <button type="button" onClick={submitNote} disabled={noteBusy} className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-black disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                  {noteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {ar ? 'أضف إلى القضية' : 'Add to case'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ---------- MY CASES LIST ---------- */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-base text-(--tx-strong) dark:text-[#f5ebd9]">{ar ? 'قضاياي' : 'My cases'}</h2>
            <button
              type="button"
              onClick={() => setShowNewCase((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {ar ? 'افتح قضية جديدة' : 'Open a new case'}
            </button>
          </div>

          {/* New case form */}
          {showNewCase && (
            <div className="rounded-3xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) shadow-sm p-4 sm:p-5 space-y-3">
              <h3 className="font-black text-sm text-(--tx-strong) dark:text-[#f5ebd9]">{ar ? 'قضية جديدة — سرية تماماً' : 'New case — completely private'}</h3>
              <input value={ncTitle} onChange={(e) => setNcTitle(e.target.value)} placeholder={ar ? 'عنوان القضية (مثال: خلاف حول…)' : 'Case title (e.g. Disagreement about…)'} className={inputCls} />
              <div>
                <p className="text-xs font-black text-(--tx-ph) mb-1.5">{ar ? 'أنا:' : 'I am the:'}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNcMyRole('husband')} className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 cursor-pointer ${ncMyRole === 'husband' ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100' : 'border-(--ln-gold) text-(--tx-ph)'}`}>
                    {ar ? 'الزوج' : 'Husband'}
                  </button>
                  <button type="button" onClick={() => setNcMyRole('wife')} className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 cursor-pointer ${ncMyRole === 'wife' ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100' : 'border-(--ln-gold) text-(--tx-ph)'}`}>
                    {ar ? 'الزوجة' : 'Wife'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={ncSpouseName} onChange={(e) => setNcSpouseName(e.target.value)} placeholder={ar ? 'اسم الزوج / الزوجة' : 'Spouse name'} className={inputCls} />
                <input value={ncSpousePhone} onChange={(e) => setNcSpousePhone(e.target.value)} placeholder={ar ? 'هاتف الزوج / الزوجة' : 'Spouse phone'} className={inputCls} />
                <input value={ncMyPhone} onChange={(e) => setNcMyPhone(e.target.value)} placeholder={ar ? 'هاتفي' : 'My phone'} className={inputCls} />
              </div>
              <select value={ncCounselorId} onChange={(e) => setNcCounselorId(e.target.value)} className={inputCls}>
                <option value="">{ar ? 'اختر كاهناً / مرشداً (اختياري)' : 'Choose a priest / counselor (optional)'}</option>
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.role})</option>
                ))}
              </select>
              <textarea value={ncFirstNote} onChange={(e) => setNcFirstNote(e.target.value)} rows={3} placeholder={ar ? 'ما الذي حدث؟ اكتب ما تشتكي منه…' : 'What happened? Write what you are complaining about…'} className={inputCls} />
              <div className="relative">
                <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--tx-ph) pointer-events-none" />
                <input value={ncPhotoUrl} onChange={(e) => setNcPhotoUrl(e.target.value)} placeholder={ar ? 'رابط صورة (اختياري): https://… .jpg' : 'Photo link (optional): https://… .jpg'} className={`${inputCls} pl-9`} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitNewCase} disabled={ncBusy} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-black disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5">
                  {ncBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {ar ? 'افتح القضية' : 'Open case'}
                </button>
                <button type="button" onClick={() => setShowNewCase(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-black cursor-pointer">
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
              <p className="text-[11px] font-medium text-(--tx-ph) flex items-start gap-1">
                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                {ar ? 'يرى هذه القضية أنت وزوجك والكاهن الذي تختاره فقط — وليس أي شخص آخر.' : 'Only you, your spouse, and the priest you choose will see this case — nobody else.'}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-(--tx-ph) text-sm font-bold">
              <Loader2 className="w-5 h-5 animate-spin" />
              {ar ? 'جارٍ تحميل القضايا…' : 'Loading cases…'}
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-3xl bg-(--bg-card) dark:bg-[#282019] border border-dashed border-(--ln-gold) p-8 text-center">
              <HeartHandshake className="w-10 h-10 mx-auto text-amber-600 dark:text-amber-300" />
              <p className="font-black text-(--tx-strong) dark:text-[#f5ebd9] mt-3">{ar ? 'لا توجد قضايا بعد' : 'No cases yet'}</p>
              <p className="text-xs font-medium text-(--tx-ph) mt-1 max-w-md mx-auto leading-relaxed">
                {ar
                  ? 'إذا كانت هناك مشكلة بينك وبين زوجك، افتح قضية وسيتابعها معكما الكاهن بسرية تامة.'
                  : 'If there is a problem between you and your spouse, open a case and a priest will follow it with you in complete privacy.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCase(c.id)}
                  className="w-full text-left rounded-3xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) shadow-sm p-4 hover:shadow-md hover:border-amber-400 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-(--tx-strong) dark:text-[#f5ebd9] leading-snug truncate">{c.title}</p>
                      <p className="text-xs font-bold text-(--tx-ph) mt-1 truncate">
                        {c.counselor_name ? (ar ? `مع ${c.counselor_name}` : `With ${c.counselor_name}`) : (ar ? 'بانتظار تعيين كاهن' : 'Waiting for a priest to be assigned')}
                        {typeof c.entry_count === 'number' ? ` · ${c.entry_count} ${ar ? 'ملاحظة' : 'notes'}` : ''}
                      </p>
                      <p className="text-[11px] font-bold text-(--tx-ph) mt-0.5">{fmtDate(c.updated_at)}</p>
                    </div>
                    <span className={`${statusPill} ${c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : c.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
