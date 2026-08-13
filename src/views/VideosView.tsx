import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Upload,
  Sparkles,
  Search,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Video,
} from 'lucide-react';
import { Post } from '../types';
import { loadVideos, deletePost, savePost } from '../utils/posts';
import { uploadVideoToBunnyStream } from '../utils/storage';
import { VideoCard, VideoComment } from '../components/VideoCard';
import { useAuth } from '../context/AuthContext';
import { UserProfileData } from './ProfileView';

interface VideosViewProps {
  onSelectUser?: (userData: UserProfileData) => void;
  onOpenMessengerWithUser?: (contactId?: string) => void;
}

const POPULAR_HASHTAGS = [
  '#Orthodox',
  '#Christianity',
  '#Liturgy',
  '#Byzantine',
  '#JesusPrayer',
  '#MountAthos',
  '#Hesychasm',
  '#Saints',
  '#HolyTradition',
];

export const VideosView: React.FC<VideosViewProps> = ({
  onSelectUser,
  onOpenMessengerWithUser,
}) => {
  const { profile } = useAuth();
  const [videos, setVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Upload modal form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');

  // Social interactions state
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  // Comments drawer state per video
  const [openCommentVideoId, setOpenCommentVideoId] = useState<string | null>(null);
  const [videoCommentsMap, setVideoCommentsMap] = useState<Record<string, VideoComment[]>>({});

  // Active playing video state
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  // Feed container ref for snap scrolling
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Unmount Cleanup: Pause all media when navigating away
  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        try {
          m.pause();
          m.currentTime = 0;
        } catch (e) {
          // ignore
        }
      });
    };
  }, []);

  // Fetch videos on mount with 1.5s timeout safeguard
  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1500);

    const runFetch = async () => {
      await fetchVideosList();
      if (isMounted) setLoading(false);
    };

    runFetch();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const fetchVideosList = async () => {
    setLoading(true);
    const loadedVideos = await loadVideos();
    setVideos(loadedVideos);

    if (loadedVideos.length > 0 && !activePlayingId) {
      setActivePlayingId(loadedVideos[0].id);
    }

    let savedLikes: Record<string, boolean> = {};
    let savedComments: Record<string, VideoComment[]> = {};
    try {
      const rawLikes = localStorage.getItem('orthodox_videos_liked_map');
      if (rawLikes) savedLikes = JSON.parse(rawLikes);
      const rawComments = localStorage.getItem('orthodox_videos_comments_map');
      if (rawComments) savedComments = JSON.parse(rawComments);
    } catch (e) {
      console.warn('Videos cache read error:', e);
    }

    setLikedMap(savedLikes);

    const initialLikesCount: Record<string, number> = {};
    const initialComments: Record<string, VideoComment[]> = {};

    loadedVideos.forEach((v) => {
      const baseLikes = v.likesCount || 0;
      initialLikesCount[v.id] = savedLikes[v.id] ? baseLikes + 1 : baseLikes;
      initialComments[v.id] = savedComments[v.id] || [];
    });

    setLikeCounts(initialLikesCount);
    setVideoCommentsMap(initialComments);
    setLoading(false);
  };

  // Setup IntersectionObserver for auto-playing active snapped video
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const videoId = entry.target.getAttribute('data-video-id');
            if (videoId) {
              setActivePlayingId(videoId);
            }
          }
        });
      },
      {
        root: container,
        threshold: [0.6],
      }
    );

    const videoElements = container.querySelectorAll('[data-video-id]');
    videoElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [videos, activeTab, selectedHashtag, searchQuery]);

  // Keyboard navigation (ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleScrollNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handleScrollPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videos, activePlayingId]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleScrollNext = () => {
    if (!feedContainerRef.current) return;
    const { scrollTop, clientHeight } = feedContainerRef.current;
    feedContainerRef.current.scrollTo({
      top: scrollTop + clientHeight,
      behavior: 'smooth',
    });
  };

  const handleScrollPrev = () => {
    if (!feedContainerRef.current) return;
    const { scrollTop, clientHeight } = feedContainerRef.current;
    feedContainerRef.current.scrollTo({
      top: Math.max(0, scrollTop - clientHeight),
      behavior: 'smooth',
    });
  };

  const handleVideoUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      triggerToast('Please select a video file to upload.');
      return;
    }

    try {
      setIsUploading(true);
      triggerToast('Uploading video directly to Bunny Stream CDN...');
      const iframeUrl = await uploadVideoToBunnyStream(uploadFile, uploadFile.name);

      const newVideo = await savePost({
        text: uploadCaption.trim() || uploadFile.name.replace(/\.[^/.]+$/, ''),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        video: iframeUrl,
      });

      setVideos((prev) => [newVideo, ...prev]);
      setActivePlayingId(newVideo.id);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadCaption('');
      triggerToast('New Orthodox Video published to feed!');

      if (feedContainerRef.current) {
        feedContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Video upload error:', err);
      triggerToast('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleLike = (videoId: string) => {
    setLikedMap((prev) => {
      const isCurrentlyLiked = !!prev[videoId];
      const nextState = !isCurrentlyLiked;
      const updated = { ...prev, [videoId]: nextState };
      try {
        localStorage.setItem('orthodox_videos_liked_map', JSON.stringify(updated));
      } catch (e) {
        console.warn('Videos likes save error:', e);
      }
      setLikeCounts((cPrev) => ({
        ...cPrev,
        [videoId]: (cPrev[videoId] || 0) + (nextState ? 1 : -1),
      }));
      return updated;
    });
  };

  const handleToggleFollow = (authorName: string) => {
    setFollowedAuthors((prev) => {
      const nextVal = !prev[authorName];
      triggerToast(nextVal ? `Now following ${authorName}` : `Unfollowed ${authorName}`);
      return { ...prev, [authorName]: nextVal };
    });
  };

  const handleToggleSave = (videoId: string) => {
    setSavedMap((prev) => {
      const nextVal = !prev[videoId];
      triggerToast(nextVal ? 'Saved video to bookmarks' : 'Removed from saved');
      return { ...prev, [videoId]: nextVal };
    });
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      await deletePost(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      triggerToast('Video deleted successfully.');
    }
  };

  const handleShare = (video: Post) => {
    const url = `https://orthodoxconnect.live/videos/${video.id}`;
    navigator.clipboard.writeText(url);
    triggerToast('Video link copied to clipboard!');
  };

  const handleAddComment = (videoId: string, text: string) => {
    const newComment: VideoComment = {
      id: `comment-${Date.now()}`,
      authorName: profile?.full_name || 'Orthodox Parishioner',
      authorAvatar:
        profile?.avatar_url ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      text,
      createdAt: 'Just now',
    };

    setVideoCommentsMap((prev) => {
      const updated = {
        ...prev,
        [videoId]: [newComment, ...(prev[videoId] || [])],
      };
      try {
        localStorage.setItem('orthodox_videos_comments_map', JSON.stringify(updated));
      } catch (e) {
        console.warn('Videos comments save error:', e);
      }
      return updated;
    });
  };

  const handleHashtagClick = (tag: string) => {
    setSelectedHashtag(selectedHashtag === tag ? null : tag);
    triggerToast(`Filtering by ${tag}`);
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (activeTab === 'following' && !followedAuthors[v.authorName]) {
        return false;
      }

      if (selectedHashtag && !v.text?.toLowerCase().includes(selectedHashtag.toLowerCase())) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.text?.toLowerCase().includes(q) ||
          v.authorName?.toLowerCase().includes(q) ||
          v.authorParish?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [videos, activeTab, followedAuthors, selectedHashtag, searchQuery]);

  return (
    <div className="w-full flex flex-col items-center relative select-none pb-4">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Frame Container */}
      <div className="relative w-full max-w-[420px] h-[calc(100vh-6.5rem)] min-h-[580px] max-h-[860px] bg-black rounded-3xl overflow-hidden shadow-2xl border-2 border-[#c5a059]/40 flex flex-col">
        {/* Floating Top Bar */}
        <div className="absolute top-0 inset-x-0 z-40 px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-[#f5ebd9] cursor-pointer transition-transform active:scale-95"
            title="Search Videos"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4 font-serif">
            <button
              type="button"
              onClick={() => setActiveTab('following')}
              className={`text-sm font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'following'
                  ? 'text-white border-b-2 border-[#c5a059] pb-0.5 drop-shadow-[0_0_8px_rgba(197,160,89,0.8)]'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Following
            </button>

            <span className="text-white/30 text-xs">|</span>

            <button
              type="button"
              onClick={() => setActiveTab('foryou')}
              className={`text-sm font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'foryou'
                  ? 'text-white border-b-2 border-[#c5a059] pb-0.5 drop-shadow-[0_0_8px_rgba(197,160,89,0.8)]'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              For You
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="p-2 rounded-full bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] cursor-pointer transition-transform active:scale-95 shadow-md flex items-center justify-center font-bold"
            title="Upload Video"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Search & Hashtag Bar */}
        {isSearchOpen && (
          <div className="absolute top-14 inset-x-3 z-40 bg-[#1c1611]/95 backdrop-blur-xl border border-[#c5a059] rounded-2xl p-3 shadow-2xl space-y-2 text-[#f5ebd9]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#c5a059] absolute left-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sermons, hymns, priests..."
                className="w-full bg-[#282019] border border-[#c5a059]/50 rounded-xl pl-9 pr-8 py-1.5 text-xs text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-[#a89379] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {POPULAR_HASHTAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleHashtagClick(tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-serif border whitespace-nowrap cursor-pointer transition-colors ${
                    selectedHashtag === tag
                      ? 'bg-[#c5a059] text-[#1c1611] border-[#c5a059] font-bold'
                      : 'bg-[#282019] text-[#c5a059] border-[#c5a059]/40 hover:bg-[#c5a059]/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {selectedHashtag && (
              <div className="flex items-center justify-between pt-1 border-t border-[#c5a059]/20 text-[11px] text-[#c5a059]">
                <span>Active Tag: <b>{selectedHashtag}</b></span>
                <button
                  type="button"
                  onClick={() => setSelectedHashtag(null)}
                  className="text-red-400 hover:underline cursor-pointer"
                >
                  Clear Tag
                </button>
              </div>
            )}
          </div>
        )}

        {/* Video Snap Feed */}
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#f5ebd9] space-y-3 bg-[#1c1611]">
            <Sparkles className="w-10 h-10 text-[#c5a059] animate-spin" />
            <p className="text-xs font-serif uppercase tracking-wider text-[#c5a059] font-bold">
              Loading Orthodox Feed...
            </p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#1c1611] text-[#f5ebd9] space-y-3">
            <Film className="w-12 h-12 text-[#c5a059]/50" />
            <h3 className="font-serif-coptic font-bold text-sm text-[#f5ebd9] uppercase">
              No Videos Found
            </h3>
            <p className="text-xs text-[#a89379] font-serif max-w-xs">
              {activeTab === 'following'
                ? 'Follow your favourite Orthodox priests and creators to view their vertical videos here!'
                : 'No videos match your active filter. Try clearing your search query.'}
            </p>
            {activeTab === 'following' && (
              <button
                type="button"
                onClick={() => setActiveTab('foryou')}
                className="px-4 py-2 rounded-xl bg-[#c5a059] text-[#1c1611] font-serif font-bold text-xs uppercase cursor-pointer shadow-md"
              >
                Explore For You
              </button>
            )}
          </div>
        ) : (
          <div
            ref={feedContainerRef}
            className="w-full h-full snap-y snap-mandatory overflow-y-scroll relative"
          >
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                isPlaying={activePlayingId === video.id}
                onTogglePlay={() =>
                  setActivePlayingId(activePlayingId === video.id ? null : video.id)
                }
                onSelectUser={onSelectUser}
                onOpenMessengerWithUser={onOpenMessengerWithUser}
                liked={!!likedMap[video.id]}
                likeCount={likeCounts[video.id] || 0}
                onToggleLike={handleToggleLike}
                saved={!!savedMap[video.id]}
                onToggleSave={handleToggleSave}
                isFollowed={!!followedAuthors[video.authorName]}
                onToggleFollow={handleToggleFollow}
                onDeleteVideo={handleDeleteVideo}
                comments={videoCommentsMap[video.id] || []}
                isCommentOpen={openCommentVideoId === video.id}
                onToggleCommentOpen={(id) =>
                  setOpenCommentVideoId(openCommentVideoId === id ? null : id)
                }
                onAddComment={handleAddComment}
                onShare={handleShare}
                onHashtagClick={handleHashtagClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop Next/Prev Controls */}
      <div className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-3 z-40">
        <button
          type="button"
          onClick={handleScrollPrev}
          className="w-11 h-11 rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#1c1611] shadow-xl flex items-center justify-center transition-all cursor-pointer"
          title="Previous Video"
        >
          <ChevronUp className="w-6 h-6 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleScrollNext}
          className="w-11 h-11 rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#1c1611] shadow-xl flex items-center justify-center transition-all cursor-pointer"
          title="Next Video"
        >
          <ChevronDown className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Upload Video Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1c1611] border-2 border-[#c5a059] rounded-3xl max-w-md w-full p-6 text-[#f5ebd9] shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#c5a059]/30 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[#c5a059]" />
                <h3 className="font-serif-coptic font-bold text-base text-[#f5ebd9] uppercase">
                  Upload Vertical Video
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-full text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVideoUploadSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-[#c5a059]/50 rounded-2xl p-6 text-center hover:border-[#c5a059] transition-colors bg-[#282019]/50">
                <Upload className="w-10 h-10 text-[#c5a059] mx-auto mb-2" />
                <p className="text-xs font-serif text-[#f5ebd9] font-bold mb-1">
                  {uploadFile ? uploadFile.name : 'Select a 9:16 vertical video'}
                </p>
                <p className="text-[11px] text-[#a89379] font-serif mb-3">
                  Supports MP4, WebM, MOV directly streamed to Bunny CDN
                </p>
                <label className="px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase cursor-pointer inline-block shadow-md">
                  <span>{uploadFile ? 'Change Video' : 'Browse Files'}</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-serif text-[#c5a059] uppercase tracking-wider font-bold mb-1">
                  Description & Hashtags
                </label>
                <textarea
                  rows={3}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Share reflection details (e.g., #Orthodox #Liturgy #JesusPrayer)..."
                  className="w-full bg-[#282019] border border-[#c5a059] rounded-xl p-3 text-xs text-[#f5ebd9] placeholder-[#a89379] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#c5a059]/40 text-[#c5a059] font-serif font-bold text-xs uppercase hover:bg-[#282019] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="flex-1 py-2.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase disabled:opacity-40 cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Publish Video</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
