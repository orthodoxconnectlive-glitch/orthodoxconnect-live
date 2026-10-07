import React, { useState, useEffect } from 'react';
import { Search, Play, Plus, X, Upload, Link as LinkIcon, Mic, User, Tag, Download, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface Sermon {
  id: string;
  title: string;
  speaker: string;
  topic: string;
  description?: string;
  media_url: string;
  media_type: 'youtube' | 'audio' | 'video';
  thumbnail_url?: string;
  duration?: string;
  added_by_name?: string;
  created_at: string;
}

const CLOUDINARY_CLOUD_NAME = 'z1ihehha';
const CLOUDINARY_PRESET = 'orthodox_books';

const extractYouTubeId = (url: string): string | null => {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/.exec(url || '');
  return m ? m[1] : null;
};

const ytThumb = (url: string): string | null => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

export function SermonsView({ language }: { language: 'ar' | 'en' }) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const ar = language === 'ar';
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Sermon | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importSpeaker, setImportSpeaker] = useState('');
  const [importTopic, setImportTopic] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteSpeaker, setConfirmDeleteSpeaker] = useState<string | null>(null);

  // Add form
  const [fTitle, setFTitle] = useState('');
  const [fSpeaker, setFSpeaker] = useState('');
  const [fTopic, setFTopic] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fFile, setFFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (speakerFilter) params.set('speaker', speakerFilter);
      if (topicFilter) params.set('topic', topicFilter);
      if (search.trim()) params.set('q', search.trim());
      const data = await apiFetch<Sermon[]>(`/api/sermons?${params.toString()}`);
      setSermons(Array.isArray(data) ? data : []);
      const facets = await apiFetch<{ speakers: string[]; topics: string[] }>(`/api/sermons?facets=1`);
      if (facets) {
        setSpeakers(facets.speakers || []);
        setTopics(facets.topics || []);
      }
    } catch (e) {
      console.error('sermons load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [speakerFilter, topicFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const uploadToCloudinary = async (file: File): Promise<{ url: string; type: 'audio' | 'video' }> => {
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_PRESET);
    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo || file.type.startsWith('audio/') ? 'video' : 'raw';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST', body: data,
    });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    return { url: json.secure_url, type: isVideo ? 'video' : 'audio' };
  };

  const submitSermon = async () => {
    if (!fTitle.trim()) return;
    setSaving(true);
    try {
      let mediaUrl = fUrl.trim();
      let mediaType: 'youtube' | 'audio' | 'video' = 'youtube';
      let thumbnail: string | null = null;
      if (fFile) {
        const up = await uploadToCloudinary(fFile);
        mediaUrl = up.url;
        mediaType = up.type;
      } else if (mediaUrl) {
        if (extractYouTubeId(mediaUrl)) {
          mediaType = 'youtube';
          thumbnail = ytThumb(mediaUrl);
        } else if (/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl)) {
          mediaType = 'audio';
        } else {
          mediaType = 'video';
        }
      }
      if (!mediaUrl) throw new Error('missing media');
      await apiFetch('/api/sermons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fTitle.trim(), speaker: fSpeaker.trim(), topic: fTopic.trim(),
          description: fDesc.trim(), media_url: mediaUrl, media_type: mediaType,
          thumbnail_url: thumbnail,
        }),
      });
      setShowAdd(false);
      setFTitle(''); setFSpeaker(''); setFTopic(''); setFDesc(''); setFUrl(''); setFFile(null);
      load();
    } catch (e) {
      console.error('add sermon error', e);
    } finally {
      setSaving(false);
    }
  };

  const doImport = async () => {
    if (!importUrl.trim() || importing) return;
    setImporting(true);
    setImportMsg('');
    try {
      const res = await apiFetch<{ success: boolean; imported?: number; skipped?: number; error?: string }>('/api/sermons/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_url: importUrl.trim(), speaker: importSpeaker.trim(), topic: importTopic.trim() }),
      });
      if (res && res.success) {
        setImportMsg(ar ? `تم استيراد ${res.imported} عظة` : `Imported ${res.imported} sermons${res.skipped ? ` (${res.skipped} already here)` : ''}`);
        setImportUrl(''); setImportSpeaker(''); setImportTopic('');
        load();
      } else {
        setImportMsg(res?.error || (ar ? 'فشل الاستيراد' : 'Import failed'));
      }
    } catch (e) {
      setImportMsg(ar ? 'فشل الاستيراد' : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const isAdmin = !!(profile as any)?.is_admin;

  const deleteSermon = async (id: string) => {
    try {
      await apiFetch(`/api/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      if (playing?.id === id) setPlaying(null);
      load();
    } catch (e) { console.error('delete sermon error', e); }
  };

  const deleteSpeaker = async (speaker: string) => {
    try {
      await apiFetch(`/api/sermons?speaker=${encodeURIComponent(speaker)}`, { method: 'DELETE' });
      setConfirmDeleteSpeaker(null);
      if (speakerFilter === speaker) setSpeakerFilter('');
      load();
    } catch (e) { console.error('delete speaker error', e); }
  };

  const renderPlayer = () => {
    if (!playing) return null;
    return (
      <div className="sticky top-[66px] z-20 -mx-4 bg-(--bg-soft) dark:bg-[#18120e] shadow-lg">
        <div className="w-full aspect-video bg-black">
          {playing.media_type === 'youtube' && extractYouTubeId(playing.media_url) ? (
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeId(playing.media_url)}?autoplay=1`}
              className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media"
              title={playing.title}
            />
          ) : playing.media_type === 'audio' ? (
            <div className="w-full h-full flex items-center justify-center p-8">
              <audio src={playing.media_url} controls autoPlay className="w-full" />
            </div>
          ) : (
            <video src={playing.media_url} controls autoPlay className="w-full h-full" />
          )}
        </div>
        <div className="px-4 py-3 border-b border-(--ln-gold)/30 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold font-serif text-sm line-clamp-2">{playing.title}</div>
            {playing.speaker && <div className="text-xs text-(--tx-mute) font-serif mt-0.5">{playing.speaker}</div>}
            {playing.description && (
              <div className="text-xs font-serif text-(--tx-mute) leading-relaxed line-clamp-2 mt-1">{playing.description}</div>
            )}
          </div>
          <button onClick={() => setPlaying(null)} className="shrink-0 p-2 cursor-pointer" aria-label={ar ? 'إغلاق' : 'Close'}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  // While a sermon plays, the list below shows the others in its topic.
  const visibleSermons = playing && playing.topic
    ? sermons.filter((s) => s.id !== playing.id && s.topic === playing.topic)
    : sermons.filter((s) => !playing || s.id !== playing.id);

  return (
    <div className="space-y-4">
      {renderPlayer()}
      {playing && playing.topic && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-serif text-(--tx-mute)">{ar ? 'المزيد في' : 'More in'}</span>
          <span className="px-3 py-1 rounded-full text-xs font-serif bg-(--ac-bronze) text-white">{playing.topic}</span>
        </div>
      )}
      {/* Search + add */}
      <div className="flex gap-2">
        <form onSubmit={onSearch} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--tx-mute)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? 'ابحث بعنوان أو واعظ أو موضوع...' : 'Search title, speaker, topic...'}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold)/40 text-sm font-serif"
          />
        </form>
        {profile && (
          <>
            <button
              onClick={() => setShowImport(true)}
              title={ar ? 'استيراد قناة يوتيوب' : 'Import YouTube channel'}
              className="px-4 py-2.5 rounded-xl bg-(--bg-soft) dark:bg-[#282019] text-(--tx-strong) border border-(--ln-gold)/50 text-sm font-serif font-bold flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {ar ? 'قناة' : 'Channel'}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2.5 rounded-xl bg-(--ac-gold) text-white text-sm font-serif font-bold flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {ar ? 'أضف عظة' : 'Add'}
            </button>
          </>
        )}
      </div>

      {/* Filters */}
      {(speakers.length > 0 || topics.length > 0) && (
        <div className="space-y-2">
          {speakers.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSpeakerFilter('')}
                className={`px-3 py-1.5 rounded-full text-xs font-serif whitespace-nowrap cursor-pointer ${!speakerFilter ? 'bg-(--ac-bronze) text-white' : 'bg-(--bg-soft) border border-(--ln-gold)/40'}`}
              >
                {ar ? 'كل الوعاظ' : 'All speakers'}
              </button>
              {speakers.map((s) => (
                <span key={s} className="inline-flex items-center shrink-0">
                  <button
                    onClick={() => setSpeakerFilter(speakerFilter === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif whitespace-nowrap cursor-pointer ${speakerFilter === s ? 'bg-(--ac-bronze) text-white' : 'bg-(--bg-soft) border border-(--ln-gold)/40'}`}
                  >
                    {s}
                  </button>
                  {isAdmin && (
                    confirmDeleteSpeaker === s ? (
                      <button
                        onClick={() => deleteSpeaker(s)}
                        className="ml-1 px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-serif font-bold cursor-pointer"
                      >
                        {ar ? 'حذف الكل؟' : 'Del all?'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteSpeaker(s)}
                        className="ml-0.5 p-1 text-(--tx-mute) hover:text-red-600 cursor-pointer"
                        aria-label={ar ? 'حذف القناة' : 'Delete channel'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </span>
              ))}
            </div>
          )}
          {topics.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setTopicFilter('')}
                className={`px-3 py-1.5 rounded-full text-xs font-serif whitespace-nowrap cursor-pointer ${!topicFilter ? 'bg-(--ac-bronze) text-white' : 'bg-(--bg-soft) border border-(--ln-gold)/40'}`}
              >
                {ar ? 'كل المواضيع' : 'All topics'}
              </button>
              {topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopicFilter(topicFilter === t ? '' : t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-serif whitespace-nowrap cursor-pointer ${topicFilter === t ? 'bg-(--ac-bronze) text-white' : 'bg-(--bg-soft) border border-(--ln-gold)/40'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-(--tx-mute) font-serif text-sm animate-pulse">
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : visibleSermons.length === 0 ? (
        <div className="bg-(--bg-card) border border-(--ln-gold)/40 rounded-3xl p-12 text-center text-(--tx-mute) font-serif text-sm">
          {ar ? 'لا توجد عظات بعد — كن أول من يضيف.' : 'No sermons yet — be the first to add one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleSermons.map((s) => {
            const thumb = s.thumbnail_url || ytThumb(s.media_url);
            return (
              <div key={s.id} className="relative flex items-center gap-3 p-2.5 rounded-2xl bg-(--bg-card) border border-(--ln-gold)/40">
                {isAdmin && (
                  confirmDeleteId === s.id ? (
                    <button
                      onClick={() => deleteSermon(s.id)}
                      className="absolute top-1.5 right-1.5 px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-serif font-bold cursor-pointer"
                    >
                      {ar ? 'تأكيد؟' : 'Sure?'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg text-(--tx-mute) hover:text-red-600 cursor-pointer"
                      aria-label={ar ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
                <button onClick={() => setPlaying(s)} className="relative w-24 h-16 rounded-xl overflow-hidden shrink-0 bg-black/10 cursor-pointer">
                  {thumb ? (
                    <img src={thumb} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Mic className="w-6 h-6 text-(--tx-mute)" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-serif font-bold text-sm line-clamp-2">{s.title}</div>
                  <div className="text-[11px] text-(--tx-mute) font-serif mt-0.5 flex items-center gap-1">
                    {s.speaker && (<span className="flex items-center gap-1"><User className="w-3 h-3" />{s.speaker}</span>)}
                    {s.topic && (<span className="flex items-center gap-1"><Tag className="w-3 h-3" />{s.topic}</span>)}
                  </div>
                  {s.added_by_name && (
                    <div className="text-[10px] text-(--tx-mute) font-serif opacity-70">
                      {ar ? `أضافه: ${s.added_by_name}` : `Added by ${s.added_by_name}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-(--bg-soft) dark:bg-[#18120e] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold">{ar ? 'إضافة عظة' : 'Add a sermon'}</h3>
              <button onClick={() => setShowAdd(false)} aria-label={ar ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
            </div>
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder={ar ? 'العنوان *' : 'Title *'}
              className="w-full px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
            <div className="grid grid-cols-2 gap-2">
              <input value={fSpeaker} onChange={(e) => setFSpeaker(e.target.value)} placeholder={ar ? 'الواعظ' : 'Speaker'}
                className="px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
              <input value={fTopic} onChange={(e) => setFTopic(e.target.value)} placeholder={ar ? 'الموضوع' : 'Topic'}
                className="px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
            </div>
            <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={ar ? 'وصف (اختياري)' : 'Description (optional)'}
              rows={2} className="w-full px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
            <div className="flex items-center gap-2 text-xs font-serif text-(--tx-mute)">
              <LinkIcon className="w-4 h-4" />
              {ar ? 'رابط يوتيوب' : 'YouTube link'}
            </div>
            <input value={fUrl} onChange={(e) => { setFUrl(e.target.value); setFFile(null); }} placeholder="https://youtube.com/watch?v=..."
              className="w-full px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm" />
            <div className="flex items-center gap-2 text-xs font-serif text-(--tx-mute)">
              <Upload className="w-4 h-4" />
              {ar ? 'أو ارفع ملف صوتي / فيديو' : 'Or upload audio / video'}
            </div>
            <input type="file" accept="audio/*,video/*" onChange={(e) => { setFFile(e.target.files?.[0] || null); setFUrl(''); }}
              className="w-full text-sm font-serif" />
            {fFile && <div className="text-xs font-serif text-(--tx-mute)">{fFile.name}</div>}
            <button
              onClick={submitSermon}
              disabled={saving || !fTitle.trim() || (!fUrl.trim() && !fFile)}
              className="w-full py-3 rounded-xl bg-(--ac-gold) text-white font-serif font-bold disabled:opacity-50 cursor-pointer"
            >
              {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'إضافة العظة' : 'Add sermon')}
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowImport(false)}>
          <div className="bg-(--bg-soft) dark:bg-[#18120e] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold">{ar ? 'استيراد قناة يوتيوب' : 'Import YouTube channel'}</h3>
              <button onClick={() => setShowImport(false)} aria-label={ar ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs font-serif text-(--tx-mute) leading-relaxed">
              {ar ? 'الصق رابط قناة يوتيوب وسيتم إضافة كل فيديوهاتها كعظات.' : 'Paste a YouTube channel link and all its videos will be added as sermons.'}
            </p>
            <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://youtube.com/@..."
              className="w-full px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={importSpeaker} onChange={(e) => setImportSpeaker(e.target.value)} placeholder={ar ? 'الواعظ (اختياري)' : 'Speaker (optional)'}
                className="px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
              <input value={importTopic} onChange={(e) => setImportTopic(e.target.value)} placeholder={ar ? 'الموضوع (اختياري)' : 'Topic (optional)'}
                className="px-3 py-2.5 rounded-xl bg-(--bg-card) border border-(--ln-gold)/40 text-sm font-serif" />
            </div>
            {importMsg && <div className="text-xs font-serif text-(--tx-strong)">{importMsg}</div>}
            <button
              onClick={doImport}
              disabled={importing || !importUrl.trim()}
              className="w-full py-3 rounded-xl bg-(--ac-gold) text-white font-serif font-bold disabled:opacity-50 cursor-pointer"
            >
              {importing ? (ar ? 'جاري الاستيراد...' : 'Importing...') : (ar ? 'استيراد' : 'Import')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
