import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, X, ChevronLeft, ChevronRight, Send, Image as ImageIcon, Church } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Story, loadStories, saveStory } from '../utils/stories';
import { useAuth } from '../context/AuthContext';
import { UserProfileData } from '../views/ProfileView';

interface StoriesBarProps {
  onSelectUser?: (userData: UserProfileData) => void;
}

const SAMPLE_STORY_IMAGES = [
  'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&q=80&w=1200',
];

export const StoriesBar: React.FC<StoriesBarProps> = ({ onSelectUser }) => {
  const { profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  // Create Story Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchRealStories() {
      const local = loadStories();
      if (!isSupabaseConfigured) {
        setStories(local);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('stories')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Stories fetch note:', error.message || error);
          setStories(local);
        } else if (data && data.length > 0) {
          const mapped: Story[] = data.map((d: any) => ({
            id: d.id,
            authorName: d.author_name || d.authorName || 'Parish Member',
            authorAvatar:
              d.author_avatar ||
              d.authorAvatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            authorParish: d.author_parish || d.authorParish || 'Orthodox Church',
            imageUrl: d.image_url || d.imageUrl || '',
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
  }, []);

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

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    setIsSubmitting(true);

    const created = saveStory({
      authorName: profile?.full_name || 'Orthodox Parishioner',
      authorAvatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      authorParish: profile?.parish || 'Holy Trinity Cathedral',
      imageUrl: imageUrl.trim(),
      caption: caption.trim(),
    });

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('stories').insert([
          {
            id: created.id,
            author_name: created.authorName,
            author_avatar: created.authorAvatar,
            author_parish: created.authorParish,
            image_url: created.imageUrl,
            caption: created.caption,
            author_id: profile?.id,
          },
        ]);
        if (error) {
          console.warn('Stories insert note:', error.message || error);
        }
      } catch (err) {
        console.warn('Stories insert notice:', err);
      }
    }

    setStories([created, ...stories]);
    setCaption('');
    setImageUrl('');
    setIsCreateOpen(false);
    setIsSubmitting(false);
  };

  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-3 shadow-lg">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Add Story Button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
        >
          <div className="relative w-16 h-16 rounded-full bg-[#eedcb5] dark:bg-[#282019] border-2 border-dashed border-[#c5a059] flex items-center justify-center transition-transform group-hover:scale-105 shadow-md">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt="You"
              className="w-full h-full rounded-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-serif font-bold text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider">
            Share Story
          </span>
        </button>

        {/* Stories List */}
        {stories.map((story, idx) => (
          <button
            key={story.id}
            onClick={() => handleOpenStory(idx)}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#c5a059] via-[#f5ebd9] to-[#8f6e30] shadow-md transition-transform group-hover:scale-105">
              <div className="w-15 h-15 rounded-full p-0.5 bg-[#1c1611]">
                <img
                  src={story.authorAvatar}
                  alt={story.authorName}
                  className="w-full h-full rounded-full object-cover border border-[#c5a059]"
                />
              </div>
            </div>
            <span className="text-[10px] font-serif font-bold text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider truncate w-16 text-center">
              {story.authorName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in select-none">
          {/* Close button */}
          <button
            onClick={() => setActiveStoryIndex(null)}
            className="absolute top-6 right-6 z-50 p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-[#c5a059] hover:text-[#3d2b18] transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev/Next Overlay Nav Buttons */}
          <button
            onClick={handlePrevStory}
            disabled={activeStoryIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white hover:bg-[#c5a059] hover:text-[#3d2b18] disabled:opacity-20 cursor-pointer transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNextStory}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 text-white hover:bg-[#c5a059] hover:text-[#3d2b18] cursor-pointer transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Story Container Card */}
          <div className="relative w-full max-w-sm h-[80vh] min-h-[500px] rounded-3xl bg-[#1c1611] border-2 border-[#c5a059] overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Background Story Image */}
            <img
              src={activeStory.imageUrl}
              alt="Story"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />

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
                className="w-10 h-10 rounded-full border-2 border-[#c5a059] object-cover"
              />
              <div>
                <h4 className="font-serif-coptic font-bold text-xs text-[#f5ebd9] uppercase tracking-wider hover:underline">
                  {activeStory.authorName}
                </h4>
                <p className="text-[10px] text-[#c5a059] font-serif uppercase tracking-widest flex items-center gap-1">
                  <Church className="w-3 h-3" /> {activeStory.authorParish}
                </p>
              </div>
            </div>

            {/* Bottom Caption Overlay */}
            {activeStory.caption && (
              <div className="relative z-10 p-5 space-y-2">
                <p className="text-sm text-[#f5ebd9] font-serif leading-relaxed bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-[#c5a059]/40">
                  {activeStory.caption}
                </p>
                <span className="text-[9px] text-[#c5a059] font-serif uppercase tracking-wider block text-right font-bold">
                  Parish Story · 24h
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Story Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#1c1611] border-2 border-[#c5a059] rounded-3xl p-6 shadow-2xl text-[#f5ebd9]">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#a89379] hover:text-[#f5ebd9] hover:bg-[#282019] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#c5a059]/30">
              <Sparkles className="w-5 h-5 text-[#c5a059]" />
              <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase tracking-wider">
                Share Parish Story
              </h3>
            </div>

            <form onSubmit={handlePublishStory} className="space-y-4 text-xs font-serif">
              <div>
                <label className="block text-[#c5a059] font-bold uppercase tracking-wider mb-1.5">
                  Story Image URL
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89379]" />
                  <input
                    type="url"
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#282019] border border-[#c5a059] text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
                  />
                </div>
              </div>

              {/* Sample Photo Pickers */}
              <div>
                <span className="block text-[10px] text-[#a89379] uppercase tracking-wider mb-2 font-bold">
                  Or select a sample Orthodox photo:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {SAMPLE_STORY_IMAGES.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImageUrl(url)}
                      className={`relative h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-transform hover:scale-105 ${
                        imageUrl === url ? 'border-[#c5a059] ring-2 ring-[#c5a059]' : 'border-transparent'
                      }`}
                    >
                      <img src={url} alt={`Sample ${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#c5a059] font-bold uppercase tracking-wider mb-1.5">
                  Caption / Spiritual Note
                </label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share a thought, verse, or blessing with your parish..."
                  className="w-full p-3 rounded-xl bg-[#282019] border border-[#c5a059] text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#282019] text-[#f5ebd9] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !imageUrl.trim()}
                  className="px-5 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-white font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Story</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
