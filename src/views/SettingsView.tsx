import React, { useState } from 'react';
import {
  Church,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Globe,
  Flag,
  Clock,
  Trash2,
  Languages,
  Sparkles,
  ChevronDown,
  ShieldAlert,
  Smartphone,
  Megaphone,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch, churchesApi } from '../lib/api';
import { US_COPTIC_CHURCHES } from '../data/usCopticChurches';
import { EGYPT_COPTIC_CHURCHES } from '../data/egyptCopticChurches';
import { COPTIC_CHURCHES } from '../data/copticChurches';

interface SettingsViewProps {
  onNavigate?: (view: string) => void;
  onOpenAdminTab?: (tab: 'reports' | 'audit') => void;
}

type SectionId = 'church' | 'app' | 'mod';

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate, onOpenAdminTab }) => {
  const { t, language, setLanguage, theme, setTheme } = useTheme();
  const { profile } = useAuth();
  const ar = language === 'ar';

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const [openSection, setOpenSection] = useState<SectionId | null>('app');

  // ---- Church settings state ----
  const [churchImporting, setChurchImporting] = useState(false);
  const [churchImportProgress, setChurchImportProgress] = useState({ done: 0, total: 0 });
  const [churchImportResult, setChurchImportResult] = useState<string | null>(null);
  const [egyptImporting, setEgyptImporting] = useState(false);
  const [egyptImportProgress, setEgyptImportProgress] = useState({ done: 0, total: 0 });
  const [egyptImportResult, setEgyptImportResult] = useState<string | null>(null);
  const [ocaImporting, setOcaImporting] = useState(false);
  const [ocaImportProgress, setOcaImportProgress] = useState({ done: 0, total: 0 });
  const [ocaImportResult, setOcaImportResult] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateResult, setTranslateResult] = useState<string | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [dedupeResult, setDedupeResult] = useState<string | null>(null);

  // ---- Broadcast message state (super admin only) ----
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const isBroadcastAdmin = (profile?.email || '').toLowerCase() === 'orthodoxconnect.live@gmail.com';

  const handleBroadcast = async () => {
    if (broadcasting) return;
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title || !body) {
      setBroadcastResult(ar ? 'العنوان والرسالة مطلوبان.' : 'Title and message are required.');
      return;
    }
    if (!confirm(ar ? 'إرسال إلى جميع المستخدمين؟ لا يمكن التراجع.' : 'Send to ALL users? This cannot be undone.')) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await apiFetch<{ success: boolean; sent?: number; error?: string }>('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      if (res.success) {
        setBroadcastResult(ar ? `تم الإرسال إلى ${res.sent} مستخدم.` : `Sent to ${res.sent} users.`);
        setBroadcastTitle('');
        setBroadcastBody('');
      } else {
        setBroadcastResult(res.error || (ar ? 'فشل الإرسال.' : 'Send failed.'));
      }
    } catch (e) {
      setBroadcastResult(ar ? 'فشل الإرسال.' : 'Send failed.');
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleSection = (id: SectionId) => setOpenSection((s) => (s === id ? null : id));

  // ---- Church handlers (mirrors AdminPanelView) ----
  const handleImportChurches = async () => {
    if (churchImporting) return;
    setChurchImporting(true);
    setChurchImportResult(null);
    try {
      const existing = await churchesApi.list();
      const keyOf = (n: any, c: any) => ((n || '').trim() + '|' + (c || '').trim()).toLowerCase();
      const byNameCity = new Map<string, any>();
      for (const c of existing as any[]) {
        if (c.name) byNameCity.set(keyOf(c.name, c.city), c);
        if ((c as any).name_ar) byNameCity.set(keyOf((c as any).name_ar, (c as any).city_ar), c);
      }
      type Op = { type: 'create' | 'update'; ch: (typeof US_COPTIC_CHURCHES)[number] | (typeof EGYPT_COPTIC_CHURCHES)[number]; id?: string };
      const ops: Op[] = [];
      const payload = (ch: (typeof US_COPTIC_CHURCHES)[number] | (typeof EGYPT_COPTIC_CHURCHES)[number]) => ({
        name: ch.name,
        name_ar: (ch as any).name_ar,
        city: ch.city,
        city_ar: (ch as any).city_ar,
        country: ch.country,
        description: (ch as any).description,
        description_ar: (ch as any).description_ar,
        address: (ch as any).address || '',
        website: (ch as any).website || '',
      });
      const ALL_CHURCHES = [...US_COPTIC_CHURCHES, ...EGYPT_COPTIC_CHURCHES];
      for (const ch of ALL_CHURCHES) {
        const ex = byNameCity.get(keyOf(ch.name, ch.city)) || byNameCity.get(keyOf((ch as any).name_ar, (ch as any).city_ar));
        if (!ex) {
          ops.push({ type: 'create', ch });
        } else {
          const needsUpdate =
            (ex.name || '').trim() !== ch.name.trim() ||
            ((ex as any).name_ar || '').trim() !== (((ch as any).name_ar || '') as string).trim() ||
            (ex.city || '').trim() !== ch.city.trim();
          if (needsUpdate) ops.push({ type: 'update', ch, id: ex.id });
        }
      }
      setChurchImportProgress({ done: 0, total: ops.length });
      let ok = 0;
      for (let i = 0; i < ops.length; i += 5) {
        const batch = ops.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((op) => {
            if (op.type === 'create') {
              return churchesApi.create(payload(op.ch) as any).then(() => true).catch(() => false);
            }
            return churchesApi.update(op.id as string, payload(op.ch) as any).then(() => true).catch(() => false);
          })
        );
        ok += results.filter(Boolean).length;
        setChurchImportProgress({ done: ok, total: ops.length });
      }
      setChurchImportResult(`Done: ${ok}/${ops.length}`);
    } catch {
      setChurchImportResult('Failed');
    } finally {
      setChurchImporting(false);
    }
  };

  const handleImportEgypt = async () => {
    if (egyptImporting) return;
    setEgyptImporting(true);
    setEgyptImportResult(null);
    try {
      const existing = await churchesApi.list();
      const keyOf = (n: any, c: any) => ((n || '').trim() + '|' + (c || '').trim()).toLowerCase();
      const byNameCity = new Map<string, any>();
      for (const c of existing as any[]) {
        if (c.name) byNameCity.set(keyOf(c.name, c.city), c);
      }
      let ok = 0;
      setEgyptImportProgress({ done: 0, total: EGYPT_COPTIC_CHURCHES.length });
      for (let i = 0; i < EGYPT_COPTIC_CHURCHES.length; i += 5) {
        const batch = EGYPT_COPTIC_CHURCHES.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((ch) =>
            churchesApi
              .create({
                name: ch.name,
                city: ch.city,
                country: 'Egypt',
                address: (ch as any).address || '',
                description: 'Coptic Orthodox Church',
              } as any)
              .then(() => true)
              .catch(() => false)
          )
        );
        ok += results.filter(Boolean).length;
        setEgyptImportProgress({ done: Math.min(i + 5, EGYPT_COPTIC_CHURCHES.length), total: EGYPT_COPTIC_CHURCHES.length });
      }
      setEgyptImportResult(`Done: imported ${ok} Egypt churches`);
    } catch {
      setEgyptImportResult('Import failed');
    } finally {
      setEgyptImporting(false);
    }
  };

  const handleImportCoptic = async () => {
    if (ocaImporting) return;
    setOcaImporting(true);
    setOcaImportResult(null);
    try {
      setOcaImportProgress({ done: 0, total: COPTIC_CHURCHES.length });
      const payload = COPTIC_CHURCHES.map((ch) => ({
        name: ch.name,
        name_ar: ch.name_ar,
        city: ch.city,
        city_ar: ch.city_ar || '',
        country: ch.country,
        jurisdiction: 'Coptic Orthodox',
        description: 'Coptic Orthodox Church',
      }));
      const data = await apiFetch<any>('/api/churches/bulk', {
        method: 'POST',
        body: JSON.stringify({ churches: payload }),
      }).catch(() => ({}));
      if (data.success) {
        setOcaImportProgress({ done: data.inserted, total: COPTIC_CHURCHES.length });
        setOcaImportResult('Done: ' + data.inserted + ' added, ' + data.skipped + ' skipped');
      } else {
        setOcaImportResult('Failed: ' + (data.error || 'unknown error'));
      }
    } catch {
      setOcaImportResult('Failed');
    } finally {
      setOcaImporting(false);
    }
  };

  const handleWipe = async () => {
    if (wiping) return;
    if (!confirm(ar ? 'حذف كل الكنائس؟ لا يمكن التراجع.' : 'Delete ALL churches? This cannot be undone.')) return;
    if (!confirm(ar ? 'تأكيد حذف كل الكنائس؟' : 'Really delete every church?')) return;
    setWiping(true);
    setWipeResult(null);
    try {
      const data = await apiFetch<any>('/api/churches/delete-all', { method: 'POST' }).catch(() => ({}));
      setWipeResult(data.success ? 'Deleted ' + data.deleted + ' churches' : 'Failed: ' + (data.error || 'unknown error'));
    } catch {
      setWipeResult('Failed');
    } finally {
      setWiping(false);
    }
  };

  const handleTranslate = async () => {
    if (translating) return;
    setTranslating(true);
    setTranslateResult(null);
    try {
      const data = await apiFetch<any>('/api/churches/translate-ar', { method: 'POST' }).catch(() => ({}));
      setTranslateResult(data.success ? 'Translated ' + data.translated + ' church names to Arabic' : 'Failed: ' + (data.error || 'unknown error'));
    } catch {
      setTranslateResult('Failed');
    } finally {
      setTranslating(false);
    }
  };

  const handleDedupe = async () => {
    if (deduping) return;
    if (!confirm(ar ? 'إزالة الكنائس المكررة؟' : 'Remove duplicate churches? Keeps the most complete record per church.')) return;
    setDeduping(true);
    setDedupeResult(null);
    try {
      const data = await apiFetch<any>('/api/churches/dedupe', { method: 'POST' }).catch(() => ({}));
      setDedupeResult(data.success ? 'Done: merged ' + data.mergedGroups + ' groups, removed ' + data.deleted + ' duplicates' : 'Failed: ' + (data.error || 'unknown error'));
    } catch {
      setDedupeResult('Failed');
    } finally {
      setDeduping(false);
    }
  };

  // ---- Shared card components ----
  const ActionCard = ({
    icon,
    title,
    desc,
    btnLabel,
    onClick,
    busy,
    result,
    progress,
    danger,
  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    btnLabel: string;
    onClick: () => void;
    busy: boolean;
    result?: string | null;
    progress?: { done: number; total: number } | null;
    danger?: boolean;
  }) => (
    <div className={`flex items-center gap-4 p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 ${danger ? 'border-red-500/50' : 'border-(--ln-gold) dark:border-[#8b6b4a]'} shadow-lg`}>
      <div className={`w-12 h-12 rounded-2xl ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-(--ac-gold)/15'} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-serif font-bold text-base text-(--tx-head)">{title}</p>
        <p className="text-xs text-(--tx-soft) mt-0.5">{desc}</p>
        {busy && progress && (
          <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">Working {progress.done}/{progress.total}</p>
        )}
        {result && !busy && (
          <p className="text-xs font-bold text-(--ac-bright-tx) mt-1">{result}</p>
        )}
      </div>
      <button
        onClick={onClick}
        disabled={busy}
        className={`px-5 py-2.5 rounded-xl ${danger ? 'bg-red-600' : 'bg-(--ac-bright)'} hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0`}
      >
        {btnLabel}
      </button>
    </div>
  );

  const SectionHeader = ({ id, icon, title }: { id: SectionId; icon: React.ReactNode; title: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-4 p-5 rounded-3xl bg-(--bg-card-hi) border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg cursor-pointer hover:opacity-95 transition-all"
    >
      <div className="w-12 h-12 rounded-2xl bg-(--ac-bright)/10 border border-(--ac-bright)/30 flex items-center justify-center text-(--ac-bright-tx) shrink-0">
        {icon}
      </div>
      <p className="flex-1 text-left font-serif font-bold text-lg text-(--tx-head)">{title}</p>
      <ChevronDown className={`w-5 h-5 text-(--tx-soft) transition-transform ${openSection === id ? 'rotate-180' : ''}`} />
    </button>
  );

  const isDark = theme === 'dark';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Page title */}
      <div className="flex items-center gap-3 px-1">
        <SettingsIcon className="w-7 h-7 text-(--ac-bright-tx)" />
        <h1 className="font-serif font-bold text-2xl text-(--tx-head)">
          {ar ? 'الإعدادات' : 'Settings'}
        </h1>
      </div>

      {/* ============ APP SETTINGS ============ */}
      <SectionHeader id="app" icon={<Smartphone className="w-6 h-6" />} title={ar ? 'إعدادات التطبيق' : 'App Settings'} />
      {openSection === 'app' && (
        <div className="space-y-4 pl-1">
          {/* Theme */}
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
              {isDark ? <Moon className="w-6 h-6 text-indigo-400" /> : <Sun className="w-6 h-6 text-amber-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif font-bold text-base text-(--tx-head)">{ar ? 'المظهر' : 'Theme'}</p>
              <p className="text-xs text-(--tx-soft) mt-0.5">{ar ? 'فاتح أو داكن' : 'Light or dark mode'}</p>
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="px-5 py-2.5 rounded-xl bg-(--ac-bright) hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-2"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? (ar ? 'فاتح' : 'Light') : (ar ? 'داكن' : 'Dark')}
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif font-bold text-base text-(--tx-head)">{ar ? 'اللغة' : 'Language'}</p>
              <p className="text-xs text-(--tx-soft) mt-0.5">{ar ? 'الإنجليزية أو العربية' : 'English or Arabic'}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2.5 rounded-xl font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer ${!ar ? 'bg-(--ac-bright) text-white' : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ar')}
                className={`px-4 py-2.5 rounded-xl font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer ${ar ? 'bg-(--ac-bright) text-white' : 'bg-(--bg-card-hi) text-(--tx-soft) hover:bg-(--bg-inset)'}`}
              >
                عربي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ CHURCH SETTINGS (admin) ============ */}
      {isAdminOrOwner && (
        <>
          <SectionHeader id="church" icon={<Church className="w-6 h-6" />} title={ar ? 'إعدادات الكنائس' : 'Church Settings'} />
          {openSection === 'church' && (
            <div className="space-y-4 pl-1">
              <ActionCard
                icon={<Church className="w-6 h-6 text-(--ac-bright-tx)" />}
                title={t('adminChurchImportTitle')}
                desc={t('adminChurchImportDesc')}
                btnLabel={churchImporting ? t('adminChurchImporting') : t('adminChurchImportBtn')}
                onClick={handleImportChurches}
                busy={churchImporting}
                result={churchImportResult}
                progress={churchImportProgress}
              />
              <ActionCard
                icon={<Church className="w-6 h-6 text-(--ac-bright-tx)" />}
                title={ar ? 'كنائس مصر القبطية' : 'Egypt Coptic Churches'}
                desc={`${ar ? 'استيراد' : 'Import'} ${EGYPT_COPTIC_CHURCHES.length} ${ar ? 'كنيسة قبطية في مصر بالعناوين' : 'Coptic churches in Egypt with street addresses'}`}
                btnLabel={egyptImporting ? (ar ? 'جاري الاستيراد' : 'Importing') : (ar ? 'استيراد مصر' : 'Import Egypt')}
                onClick={handleImportEgypt}
                busy={egyptImporting}
                result={egyptImportResult}
                progress={egyptImportProgress}
              />
              <ActionCard
                icon={<Church className="w-6 h-6 text-(--ac-gold-tx)" />}
                title={ar ? 'الكنائس القبطية' : 'Coptic Churches'}
                desc={`${ar ? 'استيراد' : 'Import'} ${COPTIC_CHURCHES.length} ${ar ? 'كنيسة قبطية حول العالم' : 'Coptic churches worldwide (St-Takla sources)'}`}
                btnLabel={ocaImporting ? (ar ? 'جاري الاستيراد' : 'Importing') : (ar ? 'استيراد' : 'Import')}
                onClick={handleImportCoptic}
                busy={ocaImporting}
                result={ocaImportResult}
                progress={ocaImportProgress}
              />
              <ActionCard
                icon={<Languages className="w-6 h-6 text-(--ac-gold-tx)" />}
                title={ar ? 'الأسماء العربية' : 'Arabic Names'}
                desc={ar ? 'ترجمة أسماء الكنائس المستوردة إلى العربية' : 'Generate Arabic translations for imported churches'}
                btnLabel={translating ? (ar ? 'جاري العمل' : 'Working') : (ar ? 'ترجمة' : 'Translate')}
                onClick={handleTranslate}
                busy={translating}
                result={translateResult}
              />
              <ActionCard
                icon={<Sparkles className="w-6 h-6 text-(--ac-gold-tx)" />}
                title={ar ? 'إزالة المكرر' : 'Remove Duplicates'}
                desc={ar ? 'العثور على الكنائس المضافة أكثر من مرة' : 'Find churches added more than once and keep the best record'}
                btnLabel={deduping ? (ar ? 'جاري العمل' : 'Working') : (ar ? 'تنظيف' : 'Clean Up')}
                onClick={handleDedupe}
                busy={deduping}
                result={dedupeResult}
              />
              <ActionCard
                icon={<Trash2 className="w-6 h-6 text-red-500" />}
                title={ar ? 'حذف كل الكنائس' : 'Delete All Churches'}
                desc={ar ? 'إزالة كل كنيسة من الدليل' : 'Remove every church from the directory'}
                btnLabel={wiping ? (ar ? 'جاري العمل' : 'Working') : (ar ? 'حذف الكل' : 'Delete All')}
                onClick={handleWipe}
                busy={wiping}
                result={wipeResult}
                danger
              />
            </div>
          )}
        </>
      )}

      {/* ============ MODERATION SETTINGS (admin) ============ */}
      {isAdminOrOwner && (
        <>
          <SectionHeader id="mod" icon={<ShieldAlert className="w-6 h-6" />} title={ar ? 'إعدادات الإشراف' : 'Moderation Settings'} />
          {openSection === 'mod' && (
            <div className="space-y-4 pl-1">
              <ActionCard
                icon={<Flag className="w-6 h-6 text-orange-500" />}
                title={ar ? 'طابور البلاغات' : 'Content Reports Queue'}
                desc={ar ? 'مراجعة المحتوى المُبلغ عنه' : 'Review reported content'}
                btnLabel={ar ? 'فتح' : 'Open'}
                onClick={() => {
                  if (onOpenAdminTab) onOpenAdminTab('reports');
                  else if (onNavigate) onNavigate('admin');
                }}
                busy={false}
              />
              <ActionCard
                icon={<Clock className="w-6 h-6 text-stone-500" />}
                title={t('adminTabAudit')}
                desc={ar ? 'سجل إجراءات الإشراف' : 'Moderation action history'}
                btnLabel={ar ? 'فتح' : 'Open'}
                onClick={() => {
                  if (onOpenAdminTab) onOpenAdminTab('audit');
                  else if (onNavigate) onNavigate('admin');
                }}
                busy={false}
              />
              {/* Broadcast Message — SUPER ADMIN ONLY */}
              {isBroadcastAdmin && (
                <div className="p-4 rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
                      <Megaphone className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-serif font-bold text-base text-(--tx-head)">{ar ? 'رسالة جماعية' : 'Broadcast Message'}</p>
                      <p className="text-xs text-(--tx-soft) mt-0.5">{ar ? 'إرسال إشعار إلى جميع المستخدمين' : 'Send a notification to ALL users at once'}</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder={ar ? 'عنوان الرسالة' : 'Message title'}
                    className="w-full mb-2 px-4 py-2.5 rounded-xl border-2 border-(--ln-bright)/30 bg-(--bg-inset) text-sm font-bold text-(--tx-head) placeholder:text-(--tx-soft) focus:outline-none focus:border-(--ac-bright)"
                    disabled={broadcasting}
                  />
                  <textarea
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder={ar ? 'نص الرسالة...' : 'Message text...'}
                    rows={3}
                    className="w-full mb-2 px-4 py-2.5 rounded-xl border-2 border-(--ln-bright)/30 bg-(--bg-inset) text-sm text-(--tx-head) placeholder:text-(--tx-soft) focus:outline-none focus:border-(--ac-bright) resize-y"
                    disabled={broadcasting}
                  />
                  {broadcastResult && !broadcasting && (
                    <p className="text-xs font-bold text-(--ac-bright-tx) mb-2">{broadcastResult}</p>
                  )}
                  <button
                    onClick={handleBroadcast}
                    disabled={broadcasting}
                    className="w-full px-5 py-2.5 rounded-xl bg-(--ac-bright) hover:opacity-90 text-white font-serif font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {broadcasting ? (ar ? 'جارٍ الإرسال...' : 'Sending...') : (ar ? 'إرسال للجميع' : 'Send to All')}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
