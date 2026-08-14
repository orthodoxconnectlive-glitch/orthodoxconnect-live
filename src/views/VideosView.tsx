import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Film,
  Upload,
  Sparkles,
  Search,
  CheckCircle,
  X,
  Plus,
  Video,
} from 'lucide-react';
import { Post } from '../types';
import { loadPosts, deletePost, savePost } from '../utils/posts';
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

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');

  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  const [openCommentVideoId, setOpenCommentVideoId] = useState<string | null>(null);
  const [videoCommentsMap, setVideoCommentsMap] = useState<Record<string, VideoComment[]>>({});

  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      const allMedia = document.querySelectorAll<HTMLMediaElement>('video, audio');
      allMedia.forEach((m) => {
        try {
          m.pause();
          m.currentTime = 0;
        } catch (e) {}
      });
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      await fetchVideosList();
      if (isMounted) setLoading(false);
    };

    runFetch();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchVideosList = async () => {
    setLoading(true);

    const { posts } = await loadPosts();
    const videoPosts = posts.filter((p) => !!p.video || (p.image && p.image.endsWith('.mp4')));

    const finalVideos = videoPosts.length > 0 ? videoPosts : [
      {
        id: 'fallback-v1',
        text: 'Orthodox Spiritual Reflection & Liturgical Song ☨',
        authorName: 'OrthodoxConnect',
        authorParish: 'Parish Fellowship',
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
        createdAt: new Date().toISOString(),
        likesCount: 25,
        commentsCount: 2,
        resharesCount: 0,
      }
    ];

    setVideos(finalVideos);

    if (finalVideos.length > 0 && !activePlayingId) {
      setActivePlayingId(finalVideos[0].id);
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

    finalVideos.forEach((v) => {
      const baseLikes = v.likesCount || 0;
      initialLikesCount[v.id] = savedLikes[v.id] ? baseLikes + 1 : baseLikes;
      initialComments[v.id] = savedComments[v.id] || [];
    });

    setLikeCounts(initialLikesCount);
    setVideoCommentsMap(initialComments);
    setLoading(false);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
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
      const videoMediaUrl = await uploadVideoToBunnyStream(uploadFile, uploadFile.name);

      const newVideo = await savePost({
        text: uploadCaption.trim() || uploadFile.name.replace(/\.[^/.]+$/, ''),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        video: videoMediaUrl,
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
    <div className="w-full min-h-screen bg-[#130e0a] pb-24 px-4 flex flex-col items-center">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div className="w-full max-w-md mt-4 mb-6 flex items-center justify-between bg-[#1c1611] border-2 border-[#c5a059] p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 font-serif text-[#f5ebd9]">
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`text-xs uppercase font-bold px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === 'following' ? 'bg-[#c5a059] text-[#1c1611]' : 'hover:bg-[#282019]'
            }`}
          >
            Following
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('foryou')}
            className={`text-xs uppercase font-bold px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === 'foryou' ? 'bg-[#c5a059] text-[#1c1611]' : 'hover:bg-[#282019]'
            }`}
          >
            For You
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Upload</span>
        </button>
      </div>

      {/* Search & Hashtag Bar */}
      {isSearchOpen && (
        <div className="w-full max-w-md mb-4 bg-[#1c1611]/95 backdrop-blur-xl border border-[#c5a059] rounded-2xl p-3 shadow-2xl space-y-2 text-[#f5ebd9]">
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
                className="absolute right-2.5 text-[#a89379] hover:text-white cursor-pointer"
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

      {/* Natural Scrolling Feed Container */}
      <div ref={feedContainerRef} className="w-full max-w-md flex flex-col gap-6">
        {loading ? (
          <div className="py-20 text-center text-[#c5a059] font-serif uppercase text-xs flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 animate-spin" />
            <span>Loading Videos Feed...</span>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="py-20 text-center text-[#a89379] font-serif uppercase text-xs">
            No videos available in this view.
          </div>
        ) : (
          filteredVideos.map((video) => (
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
          ))
        )}
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
