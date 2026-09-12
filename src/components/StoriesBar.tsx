import React, { useState, useEffect, useRef } from 'react';
import { Plus, Sparkles, X, ChevronLeft, ChevronRight, Send, Image as ImageIcon, Church, Film, Music, Play, Pause, Upload, Loader2, Trash2 } from 'lucide-react';
import { storiesApi } from '../lib/api';
import { Story, loadStories, saveStory } from '../utils/stories';
import { compressImageToDataUrl, uploadVideoToBunnyStream, BUNNY_LIBRARY_ID } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserProfileData } from '../views/ProfileView';

const SAMPLE_STORY_IMAGES = [
  'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&q=80&w=1200',
];

const MAX_AUDIO_SECONDS = 90;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type MediaTab = 'image' | 'video' | 'audio';

interface StoriesBarProps {
  onSelectUser?: (userData: UserProfileData) => void;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(a.duration || 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad-audio'));
    };
    a.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('read-failed'));
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

/** Small custom audio player for audio stories. */
const StoryAudioPlayer: React.FC<{ src: string; artUrl: string }> = ({ src, artUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 bg-gradient-to-br from-[#2a1f14] via-[#1c1611] to-[#0f0c09]">
      <div className="absolute inset-0 opacity-20">
        <img src={artUrl} alt="" className="w-full h-full object-cover blur-2xl" />
      </div>
      <div className="relative w-28 h-28 rounded-full bg-(--ac-gold) flex items-center justify-center shadow-2xl border-4 border-(--ln-gold)">
        <Music className="w-12 h-12 text-white" />
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          setDuration(a.duration || 0);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />
      <button
        onClick={toggle}
        className="relative w-16 h-16 rounded-full bg-(--ac-gold) hover:bg-(--ac-bronze) text-white flex items-center justify-center shadow-xl cursor-pointer transition-transform hover:scale-105"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
      </button>
      <div className="relative w-full max-w-[240px]">
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => {
            const a = audioRef.current;
            const pct = Number(e.target.value);
            setProgress(pct);
            if (a && a.duration) {
              a.currentTime = (pct / 100) * a.duration;
            }
          }}
          className="w-full accent-[#c5a059] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[#a89379] font-serif mt-1">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export const StoriesBar: React.FC<StoriesBarProps> = ({ onSelectUser }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';
  const { t, language } = useTheme();
  const [stories, setStories] = useState<Story[]>([]);
  const [deletingStory, setDeletingStory] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  // Create Story Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<MediaTab>('image');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const ar = language === 'ar';

  useEffect(() => {
    async function fetchRealStories() {
      const local = loadStories();
      try {
        const data = await storiesApi.getAll();
        if (data && data.length > 0) {
          const mapped: Story[] = data.map((d: any) => ({
            id: d.id,
            authorId: d.author_id || d.authorId,
            authorName: d.author_name || d.authorName || (ar ? 'عضو الرعية' : 'Parish Member'),
            authorAvatar:
              d.author_avatar ||
              d.authorAvatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            authorParish: d.author_parish || d.authorParish || (ar ? 'كنيسة أرثوذكسية' : 'Orthodox Church'),
            imageUrl: d.image_url || d.imageUrl || '',
            mediaType: d.media_type || d.mediaType || 'image',
            caption: d.caption || '',
            createdAt: d.created_at || new Date().toISOString(),
          }));
          const combined = [...local];
          mapped.forEach((m) => {
            if (!combined.some((c) => c.id === m.id)) {
              combined.push(m);
            }
          });
          setStories(combined);
        } else {
          setStories(local);
        }
      } catch (e) {
        console.warn('Stories fetch notice:', e);
        setStories(local);
      }
    }

    fetchRealStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const resetForm = () => {
    setCaption('');
    setImageUrl('');
    setVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl('');
    setAudioDataUrl('');
    setAudioFileName('');
    setUploadProgress(0);
    setFormError('');
    setMediaTab('image');
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(ar ? 'يرجى اختيار ملف صورة صالح.' : 'Please select a valid image file.');
      return;
    }
    setFormError('');
    try {
      const compressed = await compressImageToDataUrl(file, 1000, 0.72);
      setImageUrl(compressed);
    } catch {
      setFormError(ar ? 'تعذر تجهيز الصورة.' : 'Could not process the image.');
    }
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setFormError(ar ? 'يرجى اختيار ملف فيديو صالح.' : 'Please select a valid video file.');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFormError(ar ? 'الفيديو كبير جداً (الحد ٢٠٠ م.ب).' : 'Video is too large (200 MB max).');
      return;
    }
    setFormError('');
    setVideoFile(file);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setFormError(ar ? 'يرجى اختيار ملف صوتي صالح.' : 'Please select a valid audio file.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setFormError(ar ? 'الملف الصوتي كبير جداً (الحد ٨ م.ب).' : 'Audio file is too large (8 MB max).');
      return;
    }
    setFormError('');
    try {
      const dur = await getAudioDuration(file);
      if (dur > MAX_AUDIO_SECONDS) {
        setFormError(
          ar
            ? `المقطع أطول من ${MAX_AUDIO_SECONDS} ثانية. اختر مقطعاً أقصر.`
            : `Audio is longer than ${MAX_AUDIO_SECONDS}s. Please pick a shorter clip.`
        );
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      setAudioDataUrl(dataUrl);
      setAudioFileName(file.name);
    } catch {
      setFormError(ar ? 'تعذر قراءة الملف الصوتي.' : 'Could not read the audio file.');
    }
  };

  const canPublish =
    !isSubmitting &&
    (mediaTab === 'image' ? !!imageUrl.trim() : mediaTab === 'video' ? !!videoFile : !!audioDataUrl);

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) return;
    setIsSubmitting(true);
    setFormError('');

    try {
      let mediaUrl = imageUrl.trim();
      let mediaType: 'image' | 'video' | 'audio' = 'image';

      if (mediaTab === 'video' && videoFile) {
        mediaType = 'video';
        setUploadProgress(1);
        const guid = await uploadVideoToBunnyStream(
          videoFile,
          `Story_${profile?.full_name || 'parish'}_${Date.now()}`,
          (pct) => setUploadProgress(pct)
        );
        mediaUrl = guid;
      } else if (mediaTab === 'audio') {
        mediaType = 'audio';
        mediaUrl = audioDataUrl;
      }

      const created = saveStory({
        authorName: profile?.full_name || (ar ? 'عضو الرعية' : 'Orthodox Parishioner'),
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorParish: profile?.parish || (ar ? 'كاتدرائية الثالوث الأقدس' : 'Holy Trinity Cathedral'),
        imageUrl: mediaUrl,
        mediaType,
        caption: caption.trim(),
      });

      try {
        await storiesApi.create({
          id: created.id,
          author_name: created.authorName,
          author_avatar: created.authorAvatar,
          author_parish: created.authorParish,
          image_url: created.imageUrl,
          media_type: mediaType,
          caption: created.caption,
          author_id: profile?.id,
        } as any);
      } catch (err) {
        console.warn('Stories insert notice:', err);
      }

      setStories([created, ...stories]);
      closeModal();
    } catch (err) {
      console.warn('Story publish failed:', err);
      setFormError(ar ? 'فشل نشر القصة. حاول مرة أخرى.' : 'Failed to publish the story. Try again.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleOpenStory = (index: number) => {
    setActiveStoryIndex(index);
  };

  const handleNextStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    }
  };

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;
  const activeMediaType = activeStory?.mediaType || 'image';

  const bunnyEmbedForStory = (guid: string) =>
    `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID || '713265'}/${guid}?autoplay=true&loop=false&muted=false&preload=true`;

  const tabBtn = (tab: MediaTab, icon: React.ReactNode, label: string) => (
    <button
      key={tab}
      type="button"
      onClick={() => {
        setMediaTab(tab);
        setFormError('');
      }}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
        mediaTab === tab
          ? 'bg-(--ac-gold) text-white shadow-md'
          : 'text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-3 shadow-lg">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Add Story Button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
        >
          <div className="relative w-16 h-16 rounded-full bg-(--bg-soft) dark:bg-[#282019] border-2 border-dashed border-(--ln-gold) flex items-center justify-center transition-transform group-hover:scale-105 shadow-md">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt="You"
              className="w-full h-full rounded-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider">
            {ar ? 'قصة جديدة' : 'Share Story'}
          </span>
        </button>

        {/* Stories List */}
        {stories.map((story, idx) => {
          const mt = story.mediaType || 'image';
          return (
            <button
              key={story.id}
              onClick={() => handleOpenStory(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            >
              <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-(--ac-gold) via-[#f5ebd9] to-(--ac-bronze-dk) shadow-md transition-transform group-hover:scale-105">
                <div className="w-15 h-15 rounded-full p-0.5 bg-[#1c1611]">
                  <img
                    src={story.authorAvatar}
                    alt={story.authorName}
                    className="w-full h-full rounded-full object-cover border border-(--ln-gold)"
                  />
                </div>
                {mt !== 'image' && (
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-(--ac-gold) border-2 border-[#1c1611] flex items-center justify-center">
                    {mt === 'video' ? (
                      <Play className="w-3 h-3 text-white ml-px" />
                    ) : (
                      <Music className="w-3 h-3 text-white" />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider truncate w-16 text-center">
                {story.authorName.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in select-none">
          {/* Close button */}
          <button
            onClick={() => setActiveStoryIndex(null)}
            className="absolute top-6 right-6 rtl:right-auto rtl:left-6 z-50 p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-(--ac-gold) hover:text-(--tx-strong) transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Delete button (author or admin) */}
          {(isAdmin || (profile?.id && activeStory.authorId && profile.id === activeStory.authorId)) && (
            <button
              onClick={async () => {
                if (deletingStory) return;
                if (!window.confirm(ar ? 'حذف هذه القصة نهائياً؟' : 'Delete this story permanently?')) return;
                setDeletingStory(true);
                try {
                  await storiesApi.delete(activeStory.id);
                  setStories((prev) => prev.filter((st) => st.id !== activeStory.id));
                  setActiveStoryIndex(null);
                } catch (e) {
                  console.warn('Story delete failed:', e);
                } finally {
                  setDeletingStory(false);
                }
              }}
              className="absolute top-6 left-6 rtl:left-auto rtl:right-6 z-50 p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-red-700 transition-colors cursor-pointer"
              title={ar ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}

          {/* Prev/Next Overlay Nav Buttons */}
          <button
            onClick={handlePrevStory}
            disabled={activeStoryIndex === 0}
            className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white hover:bg-(--ac-gold) hover:text-(--tx-strong) disabled:opacity-20 cursor-pointer transition-all"
          >
            <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
          </button>

          <button
            onClick={handleNextStory}
            className="absolute right-4 rtl:right-auto rtl:left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white hover:bg-(--ac-gold) hover:text-(--tx-strong) cursor-pointer transition-all"
          >
            <ChevronRight className="w-6 h-6 rtl:rotate-180" />
          </button>

          {/* Story Container Card */}
          <div className="relative w-full max-w-sm h-[80vh] min-h-[500px] rounded-3xl bg-[#1c1611] border-2 border-(--ln-gold) overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Media */}
            {activeMediaType === 'image' && (
              <>
                <img
                  src={activeStory.imageUrl}
                  alt="Story"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />
              </>
            )}
            {activeMediaType === 'video' && (
              <iframe
                key={activeStory.id}
                src={bunnyEmbedForStory(activeStory.imageUrl)}
                title="Story video"
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            )}
            {activeMediaType === 'audio' && (
              <StoryAudioPlayer src={activeStory.imageUrl} artUrl={activeStory.authorAvatar} />
            )}

            {/* Top Author Header */}
            <div
              className="relative z-10 p-4 flex items-center gap-3 cursor-pointer hover:opacity-90"
              onClick={() => {
                setActiveStoryIndex(null);
                onSelectUser?.({
                  name: activeStory.authorName,
                  avatar: activeStory.authorAvatar,
                  parish: activeStory.authorParish,
                });
              }}
            >
              <img
                src={activeStory.authorAvatar}
                alt={activeStory.authorName}
                className="w-10 h-10 rounded-full border-2 border-(--ln-gold) object-cover"
              />
              <div>
                <h4 className="font-serif-coptic font-bold text-xs text-[#f5ebd9] uppercase tracking-wider hover:underline">
                  {activeStory.authorName}
                </h4>
                <p className="text-[10px] text-(--ac-gold-tx) font-serif uppercase tracking-widest flex items-center gap-1">
                  <Church className="w-3 h-3" /> {activeStory.authorParish}
                </p>
              </div>
            </div>

            {/* Bottom Caption Overlay */}
            {activeStory.caption && (
              <div className="relative z-10 p-5 space-y-2">
                <p className="text-sm text-[#f5ebd9] font-serif leading-relaxed bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-(--ln-gold)/40">
                  {activeStory.caption}
                </p>
                <span className="text-[9px] text-(--ac-gold-tx) font-serif uppercase tracking-wider block text-right rtl:text-left font-bold">
                  {ar ? 'قصة الرعية · 24 س' : 'Parish Story · 24h'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Story Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar bg-[#1c1611] border-2 border-(--ln-gold) rounded-3xl p-6 shadow-2xl text-[#f5ebd9]">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-(--ln-gold)/30">
              <Sparkles className="w-5 h-5 text-(--ac-gold-tx)" />
              <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                {ar ? 'مشاركة قصة للرعية' : 'Share Parish Story'}
              </h3>
            </div>

            {/* Media type tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-[#282019] border border-(--ln-gold)/30 mb-4">
              {tabBtn('image', <ImageIcon className="w-4 h-4" />, ar ? 'صورة' : 'Photo')}
              {tabBtn('video', <Film className="w-4 h-4" />, ar ? 'فيديو' : 'Video')}
              {tabBtn('audio', <Music className="w-4 h-4" />, ar ? 'صوت' : 'Audio')}
            </div>

            <form onSubmit={handlePublishStory} className="space-y-4 text-xs font-serif">
              {/* PHOTO TAB */}
              {mediaTab === 'image' && (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-(--ln-gold) text-(--ac-gold-tx) hover:bg-[#282019] transition-colors cursor-pointer font-bold uppercase tracking-wider"
                    >
                      <Upload className="w-4 h-4" />
                      {ar ? 'ارفع صورة من جهازك' : 'Upload a photo'}
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoFileSelect}
                    />
                    {imageUrl.startsWith('data:') && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-(--ln-gold)/40">
                        <img src={imageUrl} alt="preview" className="w-full h-32 object-cover" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1.5">
                      {ar ? 'أو رابط صورة القصة' : 'Or story image URL'}
                    </label>
                    <div className="relative">
                      <ImageIcon className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
                      <input
                        type="url"
                        value={imageUrl.startsWith('data:') ? '' : imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2.5 rounded-xl bg-[#282019] border border-(--ln-gold) text-[#f5ebd9] placeholder-(--tx-ph-dark) focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] text-[#a89379] uppercase tracking-wider mb-2 font-bold">
                      {ar ? 'أو اختر صورة أرثوذكسية نموذجية:' : 'Or select a sample Orthodox photo:'}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {SAMPLE_STORY_IMAGES.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setImageUrl(url)}
                          className={`relative h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105 ${
                            imageUrl === url ? 'border-(--ln-gold) ring-2 ring-(--ac-gold)' : 'border-transparent'
                          }`}
                        >
                          <img src={url} alt={`Sample ${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* VIDEO TAB */}
              {mediaTab === 'video' && (
                <div>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-(--ln-gold) text-(--ac-gold-tx) hover:bg-[#282019] transition-colors cursor-pointer font-bold uppercase tracking-wider"
                  >
                    <Film className="w-4 h-4" />
                    {ar ? 'ارفع فيديو قصير من جهازك' : 'Upload a short video'}
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoFileSelect}
                  />
                  {videoPreviewUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-(--ln-gold)/40">
                      <video src={videoPreviewUrl} className="w-full h-40 object-cover" muted playsInline />
                      <p className="px-3 py-1.5 text-[10px] text-[#a89379] truncate">{videoFile?.name}</p>
                    </div>
                  )}
                  {isSubmitting && uploadProgress > 0 && (
                    <div className="mt-2">
                      <div className="h-2 rounded-full bg-[#282019] overflow-hidden">
                        <div
                          className="h-full bg-(--ac-gold) transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#a89379] mt-1 text-center">
                        {ar ? `جارٍ رفع الفيديو... ${uploadProgress}٪` : `Uploading video... ${uploadProgress}%`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AUDIO TAB */}
              {mediaTab === 'audio' && (
                <div>
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-(--ln-gold) text-(--ac-gold-tx) hover:bg-[#282019] transition-colors cursor-pointer font-bold uppercase tracking-wider"
                  >
                    <Music className="w-4 h-4" />
                    {ar ? 'ارفع مقطع صوتي أو موسيقى' : 'Upload audio or music'}
                  </button>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioFileSelect}
                  />
                  <p className="text-[10px] text-[#a89379] mt-1.5 text-center">
                    {ar
                      ? 'حتى ٩٠ ثانية وبحد أقصى ٨ م.ب — ترنيمة، آية مسموعة، أو موسيقى'
                      : 'Up to 90 seconds, 8 MB max — a hymn, a verse, or music'}
                  </p>
                  {audioDataUrl && (
                    <div className="mt-2 p-3 rounded-xl bg-[#282019] border border-(--ln-gold)/40 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-(--ac-gold) flex items-center justify-center shrink-0">
                        <Music className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-[11px] text-[#f5ebd9] truncate flex-1">{audioFileName}</p>
                      <audio src={audioDataUrl} controls className="w-28 h-8" />
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}

              <div>
                <label className="block text-(--ac-gold-tx) font-bold uppercase tracking-wider mb-1.5">
                  {ar ? 'تسمية توضيحية / خاطرة روحية' : 'Caption / Spiritual Note'}
                </label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={
                    ar
                      ? 'شارك فكرة، آية، أو بركة مع رعيتك...'
                      : 'Share a thought, verse, or blessing with your parish...'
                  }
                  className="w-full p-3 rounded-xl bg-[#282019] border border-(--ln-gold) text-[#f5ebd9] placeholder-(--tx-ph-dark) focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-[#282019] text-[#f5ebd9] font-bold uppercase tracking-wider cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!canPublish}
                  className="px-5 py-2 rounded-xl bg-(--ac-gold) hover:bg-(--ac-bronze) text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                  )}
                  <span>{ar ? 'نشر القصة' : 'Publish Story'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
