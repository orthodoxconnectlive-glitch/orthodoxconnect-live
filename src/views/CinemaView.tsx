import React, { useState, useEffect } from 'react';
import { Clapperboard, Play, Plus, Trash2, X, Loader2, Film } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface CinemaFilm {
  id: string;
  title: string;
  description: string;
  youtube_id: string;
  category: 'history' | 'movie';
  created_at?: string;
}

type CatFilter = 'all' | 'history' | 'movie';

const isPlaylist = (f: CinemaFilm) => f.youtube_id.startsWith('list:');
const playlistId = (f: CinemaFilm) => f.youtube_id.slice(5);
const embedUrl = (f: CinemaFilm) =>
  isPlaylist(f)
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId(f)}&autoplay=1`
    : `https://www.youtube.com/embed/${f.youtube_id}?autoplay=1&rel=0`;

export const CinemaView: React.FC = () => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';

  const [films, setFilms] = useState<CinemaFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CatFilter>('all');
  const [playing, setPlaying] = useState<CinemaFilm | null>(null);

  // Admin add form
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<'history' | 'movie'>('movie');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const isSuperAdmin = profile?.email?.toLowerCase() === 'orthodoxconnect.live@gmail.com' || profile?.role === 'super_admin';
  const isAdminOrOwner = isSuperAdmin || profile?.role === 'admin' || profile?.role === 'owner';

  const load = async () => {
    setLoading(true);
    try {
      const d: any = await apiFetch('/api/cinema');
      setFilms(d.films || []);
    } catch (e) {
      setFilms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = films.filter((f) => filter === 'all' || f.category === filter);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      setMsg(ar ? 'اكتب الاسم ورابط اليوتيوب.' : 'Enter a title and a YouTube link.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const d: any = await apiFetch('/api/cinema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), youtube_url: newUrl.trim(), description: newDesc.trim(), category: newCat }),
      });
      if (d.success) {
        const added = d.films || (d.film ? [d.film] : []);
        setFilms((prev) => [...added, ...prev]);
        setNewTitle(''); setNewUrl(''); setNewDesc(''); setNewCat('movie');
        setShowAdd(false);
        if (d.count > 1) setMsg(ar ? `تمت إضافة ${d.count} فيلم من القائمة.` : `${d.count} films added from the playlist.`);
      } else {
        setMsg(d.error || (ar ? 'حدث خطأ.' : 'Something went wrong.'));
      }
    } catch (e) {
      setMsg(ar ? 'حدث خطأ.' : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/cinema/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setFilms((prev) => prev.filter((f) => f.id !== id));
    } catch (e) { /* best-effort */ }
  };

  const catLabel = (c: string) => (c === 'history' ? (ar ? 'تاريخ' : 'History') : (ar ? 'أفلام' : 'Movies'));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-(--ac-gold)/15 border-2 border-(--ln-gold) flex items-center justify-center shrink-0">
          <Clapperboard className="w-6 h-6 text-(--ac-gold-tx)" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif-coptic font-black text-xl text-(--tx-strong) dark:text-[#f5ebd9]">
            {ar ? 'السينما القبطية' : 'Coptic Cinema'}
          </h1>
          <p className="text-xs text-(--tx-mute)">
            {ar ? 'تاريخنا وأفلامنا في مكان واحد' : 'Our history and films in one place'}
          </p>
        </div>
        {isAdminOrOwner && (
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="px-4 py-2 rounded-xl bg-(--ac-gold) text-white text-sm font-bold cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> {ar ? 'أضف فيلم' : 'Add film'}
          </button>
        )}
      </div>

      {/* Admin add form */}
      {isAdminOrOwner && showAdd && (
        <div className="mb-5 rounded-2xl border-2 border-(--ln-gold) dark:border-[#8b6b4a] bg-(--bg-card) dark:bg-[#1c1611] p-4 space-y-2.5 shadow-lg">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={ar ? 'اسم الفيلم' : 'Film title'}
            className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm text-(--tx-strong) dark:text-[#f5ebd9] focus:outline-none"
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={ar ? 'رابط اليوتيوب' : 'YouTube link'}
            dir="ltr"
            className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm text-(--tx-strong) dark:text-[#f5ebd9] focus:outline-none"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={ar ? 'وصف قصير (اختياري)' : 'Short description (optional)'}
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm text-(--tx-strong) dark:text-[#f5ebd9] focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as 'history' | 'movie')}
              className="px-3 py-2 rounded-xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) text-sm text-(--tx-strong) dark:text-[#f5ebd9]"
            >
              <option value="movie">{ar ? 'أفلام' : 'Movies'}</option>
              <option value="history">{ar ? 'تاريخ' : 'History'}</option>
            </select>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl bg-(--ac-gold) text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <Plus className="w-4 h-4" /> {ar ? 'أضف' : 'Add'}
            </button>
          </div>
          {msg && <p className="text-xs font-bold text-(--ac-gold-tx)">{msg}</p>}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'history', 'movie'] as CatFilter[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
              filter === c
                ? 'bg-(--ac-gold) text-white shadow'
                : 'bg-(--bg-soft) dark:bg-[#282019] text-(--tx-mute) border border-(--ln-gold)/40'
            }`}
          >
            {c === 'all' ? (ar ? 'الكل' : 'All') : catLabel(c)}
          </button>
        ))}
      </div>

      {/* Film grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-(--ac-gold-tx)" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-(--tx-mute)">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-bold">{ar ? 'لا توجد أفلام بعد.' : 'No films yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl overflow-hidden bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold)/40 dark:border-[#8b6b4a]/40 shadow-md"
            >
              <button
                type="button"
                onClick={() => setPlaying(f)}
                className="relative w-full aspect-video cursor-pointer group block"
              >
                {isPlaylist(f) ? (
                  <span className="w-full h-full bg-gradient-to-br from-[#0e1c40] to-[#13264e] flex flex-col items-center justify-center gap-1.5">
                    <Clapperboard className="w-8 h-8 text-[#e8c25a]" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#e8c25a]/80">
                      {ar ? 'قائمة تشغيل' : 'Playlist'}
                    </span>
                  </span>
                ) : (
                  <img
                    src={`https://img.youtube.com/vi/${f.youtube_id}/hqdefault.jpg`}
                    alt={f.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
                <span className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="w-12 h-12 rounded-full bg-black/60 border-2 border-white/70 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </span>
                </span>
                <span className="absolute top-2 left-2 rtl:left-auto rtl:right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold uppercase">
                  {catLabel(f.category)}
                </span>
              </button>
              <div className="p-2.5 flex items-start gap-2">
                <p className="flex-1 min-w-0 text-xs font-bold text-(--tx-strong) dark:text-[#f5ebd9] line-clamp-2 leading-snug">
                  {f.title}
                </p>
                {isAdminOrOwner && (
                  <button
                    type="button"
                    onClick={() => handleDelete(f.id)}
                    className="p-1 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-950 cursor-pointer shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Player modal */}
      {playing && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1c1611]">
              <p className="text-sm font-bold text-[#f5ebd9] truncate flex-1">{playing.title}</p>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="p-1.5 rounded-lg text-[#f5ebd9]/70 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl(playing)}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            {playing.description && (
              <p className="px-4 py-3 text-xs text-[#f5ebd9]/80 bg-[#1c1611] leading-relaxed">
                {playing.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
