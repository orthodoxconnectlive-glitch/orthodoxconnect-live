import React, { useState, useEffect } from 'react';
import {
  Film,
  Upload,
  Sparkles,
  Search,
  RefreshCw,
  Video,
  CheckCircle,
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

export const VideosView: React.FC<VideosViewProps> = ({
  onSelectUser,
  onOpenMessengerWithUser,
}) => {
  const { profile } = useAuth();
  const [videos, setVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Social interactions state
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  // Comments drawer state per video
  const [openCommentVideoId, setOpenCommentVideoId] = useState<string | null>(null);
  const [videoCommentsMap, setVideoCommentsMap] = useState<Record<string, VideoComment[]>>({});

  // Strict Tab Isolation & Total Unmount Cleanup
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

  // Fetch videos from persistent database
  useEffect(() => {
    fetchVideosList();
  }, []);

  const fetchVideosList = async () => {
    setLoading(true);
    const loadedVideos = await loadVideos();
    setVideos(loadedVideos);

    // Read cached likes and comments
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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleVideoUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      triggerToast('Please select a valid video file.');
      return;
    }
    try {
      setIsUploading(true);
      triggerToast('Uploading video directly to Bunny Stream CDN...');
      const iframeUrl = await uploadVideoToBunnyStream(file, file.name);

      const newVideo = await savePost({
        text: file.name.replace(/\.[^/.]+$/, ''),
        authorName: profile?.full_name || 'Orthodox Parishioner',
        authorParish: profile?.parish || 'Orthodox Church',
        authorAvatar:
          profile?.avatar_url ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        authorId: profile?.id,
        video: iframeUrl,
      });

      setVideos((prev) => [newVideo, ...prev]);
      triggerToast('New Orthodox Video uploaded successfully!');
    } catch (err) {
      console.error('Video upload error:', err);
      triggerToast('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
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

  const filteredVideos = videos.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.text?.toLowerCase().includes(q) ||
      v.authorName?.toLowerCase().includes(q) ||
      v.authorParish?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1611]/95 border-2 border-[#c5a059] text-[#f5ebd9] text-xs font-serif uppercase tracking-wider font-bold shadow-2xl animate-fade-in flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Videos Top Header & Upload Bar */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] flex items-center justify-center text-[#c5a059] shadow-inner">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif-coptic font-bold text-base text-[#3d2b18] dark:text-[#f5ebd9] leading-tight">
              Orthodox Videos
            </h2>
            <p className="text-xs text-[#7c5f3d] dark:text-[#c5a059] font-serif">
              Sermons, Hymns, Divine Liturgies & Parish Reflections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#a8833c] text-[#1c1611] font-serif font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-colors">
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Uploading...' : 'Upload Video'}</span>
            <input
              type="file"
              accept="video/*"
              disabled={isUploading}
              onChange={handleVideoUploadSelect}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={fetchVideosList}
            className="p-2 rounded-xl bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] dark:text-[#c5a059] hover:bg-[#c5a059] hover:text-[#1c1611] transition-colors border border-[#c5a059]/40 cursor-pointer"
            title="Refresh Video Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#7c5f3d] dark:text-[#c5a059] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search videos by sermon title, saint, or priest..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] text-xs text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d]/70 dark:placeholder-[#a89379] focus:outline-none shadow-sm font-serif"
        />
      </div>

      {/* Video Feed Content List */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] dark:border-[#8b6b4a] shadow-lg">
          <Sparkles className="w-8 h-8 text-[#c5a059] animate-spin mb-3" />
          <span className="text-xs text-[#3d2b18] dark:text-[#f5ebd9] font-serif uppercase tracking-wider font-bold">
            Loading Orthodox Video Feed...
          </span>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="p-12 text-center bg-[#f6ebd6] dark:bg-[#1c1611] rounded-3xl border-2 border-[#c5a059] dark:border-[#8b6b4a] shadow-lg">
          <Film className="w-10 h-10 text-[#c5a059]/60 mx-auto mb-3" />
          <h3 className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] uppercase mb-1">
            No Videos Found
          </h3>
          <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif">
            {searchQuery
              ? 'No videos match your search criteria. Try a different query.'
              : 'Be the first to upload an Orthodox video or parish sermon!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
