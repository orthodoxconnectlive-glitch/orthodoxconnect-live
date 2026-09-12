import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat,
  Share2,
  Trash2,
  Flag,
  UserPlus,
  UserCheck,
  MessageSquare,
  Church,
  Send,
  X,
  Sparkles,
  Volume2,
  Square,
} from 'lucide-react';
import { Post, UserProfile, PostComment } from '../types';
import { TimeAgo } from './TimeAgo';
import { BroadcastCard } from './BroadcastCard';
import { AudioPlayer } from './AudioPlayer';
import { useTheme } from '../context/ThemeContext';
import { fetchPostLikes, BUNNY_LIBRARY_ID, BUNNY_CDN_HOSTNAME } from '../utils/posts';

interface PostCardProps {
  post: Post;
  currentProfile: UserProfile | null;
  onSelectUser?: (user: { id?: string; name: string; avatar: string; parish: string }) => void;
  onOpenMessengerWithUser?: (userIdOrName: string) => void;
  onToggleFollow?: (authorName: string) => void;
  isFollowed?: boolean;
  onToggleLike: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onOpenReport: (type: 'post' | 'comment', id: string, authorName: string, snippet: string) => void;
  onReshare: (post: Post) => void;
  comments?: PostComment[] | string[];
  isCommentsOpen: boolean;
  onToggleComments: () => void;
  onAddComment: (postId: string, commentText: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
}

export function parseVideoEmbed(raw?: string | null): { type: 'youtube' | 'vimeo' | 'direct'; embedUrl: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleanUrl = raw.trim();

  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }

  const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  if (/\.(mp4|webm|ogg)$/i.test(cleanUrl)) {
    return {
      type: 'direct',
      embedUrl: cleanUrl,
    };
  }

  return null;
}

export function extractCleanVideoId(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (parseVideoEmbed(trimmed)) return null;

  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i;
  const match = trimmed.match(guidRegex);
  if (match) return match[1];

  if (/^[0-9a-fA-F-]{10,}$/.test(trimmed) && !trimmed.startsWith('http') && !trimmed.includes('/')) {
    return trimmed;
  }

  if (trimmed.includes('mediadelivery.net') || trimmed.includes('bunnycdn.com') || trimmed.includes('b-cdn.net')) {
    const parts = trimmed.split('?')[0].split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && (lastPart.length >= 10 || guidRegex.test(lastPart))) {
      const pMatch = lastPart.match(guidRegex);
      return pMatch ? pMatch[1] : lastPart;
    }
  }

  return null;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentProfile,
  onSelectUser,
  onOpenMessengerWithUser,
  onToggleFollow,
  isFollowed = false,
  onToggleLike,
  onDeletePost,
  onOpenReport,
  onReshare,
  comments = [],
  isCommentsOpen,
  onToggleComments,
  onAddComment,
  onDeleteComment,
}) => {
  const { t, language } = useTheme();
  const [commentInput, setCommentInput] = useState<string>('');
  const [showLikesModal, setShowLikesModal] = useState<boolean>(false);
  const [modalLikers, setModalLikers] = useState<any[]>([]);
  const [isLoadingLikers, setIsLoadingLikers] = useState<boolean>(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Sync state from D1 snake_case or standard camelCase
  const rawPost = post as any;
  const [isLiked, setIsLiked] = useState<boolean>(Boolean(post.isLiked || rawPost.is_liked));
  const [likesCount, setLikesCount] = useState<number>(
    Number(rawPost.likes_count ?? post.likesCount ?? 0)
  );
  const [likers, setLikers] = useState<any[]>(post.likers || []);

  const postContent = (post.content ?? post.text ?? '').trim();

  // Cancel Speech on Component Unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Synchronize state when post props change
  useEffect(() => {
    setIsLiked(Boolean(post.isLiked || rawPost.is_liked));
    setLikesCount(Number(rawPost.likes_count ?? post.likesCount ?? 0));
    if (post.likers) {
      setLikers(post.likers);
    }
  }, [post.isLiked, rawPost.is_liked, post.likesCount, rawPost.likes_count, post.likers]);

  // Automatically fetch who liked this post if likes exist
  useEffect(() => {
    if (likesCount > 0 && (!likers || likers.length === 0)) {
      fetchPostLikes(post.id)
        .then((data) => {
          if (data && data.length > 0) {
            setLikers(data);
          }
        })
        .catch((err) => console.warn('Silent liker prefetch failed:', err));
    }
  }, [post.id, likesCount]);

  const toggleTextToSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(language === 'ar' ? 'القراءة الصوتية غير مدعومة في هذا المتصفح' : 'Text-to-speech is not supported on this browser');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!postContent) return;

    window.speechSynthesis.cancel();
    const chunks = postContent.match(/[^.!?،؛\n]+[.!?،؛\n]?/g) || [postContent];
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find((v) => v.lang.startsWith('ar'));

    setIsSpeaking(true);

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      if (arabicVoice) utterance.voice = arabicVoice;

      if (index === chunks.length - 1) {
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
      }

      window.speechSynthesis.speak(utterance);
    });
  };

  const authorName = post.authorName || post.author_name || rawPost.profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner');
  const authorParish = post.authorParish || post.author_parish || rawPost.profile?.parish || (language === 'ar' ? 'كنيسة أرثوذكسية' : 'Orthodox Parish');
  const authorAvatar = post.authorAvatar || post.author_avatar || rawPost.profile?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
  const authorId = post.authorId || post.author_id || rawPost.author_id;
  const postImage = post.imageUrl || post.image || post.image_url || null;

  const rawVideoSource = post.videoId || post.video_id || post.video || undefined;
  const parsedEmbed = parseVideoEmbed(rawVideoSource);
  const cleanVideoId = extractCleanVideoId(rawVideoSource);

  const libraryId = BUNNY_LIBRARY_ID || '713265';
  const cdnHost = BUNNY_CDN_HOSTNAME || 'vz-840ad26e-6fe.b-cdn.net';

  const isSuperAdminOrAuthor =
    currentProfile?.id === authorId ||
    currentProfile?.role === 'admin' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'super_admin' ||
    currentProfile?.email === 'orthodoxconnect.live@gmail.com';

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked((prev) => !prev);
    setLikesCount((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1));
    onToggleLike(post.id);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(post.id, commentInput.trim());
    setCommentInput('');
  };

  const handleOpenLikesModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLikesModal(true);
    setIsLoadingLikers(true);

    try {
      const fetched = await fetchPostLikes(post.id);
      if (fetched && fetched.length > 0) {
        setModalLikers(fetched);
      } else if (likers && likers.length > 0) {
        setModalLikers(likers);
      } else {
        setModalLikers([]);
      }
    } catch (err) {
      console.warn('Failed to load likers:', err);
      setModalLikers(likers || []);
    } finally {
      setIsLoadingLikers(false);
    }
  };

  const hasAudio = Boolean(post.audio || post.audioUrl || post.audio_url);
  const audioSource = post.audio || post.audioUrl || post.audio_url;
  const hasGenericVideo = Boolean(post.broadcastUrl || post.broadcast_url);
  const genericVideoSource = post.broadcastUrl || post.broadcast_url;

  const formattedComments: PostComment[] = comments.map((c, idx) => {
    if (typeof c === 'string') {
      return {
        id: `comm-fallback-${idx}`,
        post_id: post.id,
        postId: post.id,
        author_name: language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner',
        authorName: language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner',
        author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        content: c,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    }
    return c;
  });

  // Construct readable like string: "You and [Name]", "[Name 1] and 5 others", etc.
  const totalLikes = likesCount;
  let likeSummaryText = '';
  if (totalLikes > 0) {
    if (isLiked) {
      if (totalLikes === 1) {
        likeSummaryText = language === 'ar' ? 'أنت باركت هذا' : 'You blessed this';
      } else {
        const otherName = likers?.find((l) => l.userId !== currentProfile?.id && l.userId !== 'me')?.userName;
        likeSummaryText = otherName
          ? (language === 'ar' ? `أنت، ${otherName} و ${totalLikes - 2 > 0 ? `${totalLikes - 2} آخرين` : ''}` : `You, ${otherName} and ${totalLikes - 2 > 0 ? `${totalLikes - 2} others` : ''}`)
          : (language === 'ar' ? `أنت و ${totalLikes - 1} آخرين` : `You and ${totalLikes - 1} others`);
      }
    } else {
      if (likers && likers.length > 0) {
        const first = likers[0]?.userName || (language === 'ar' ? 'عضو الرعية' : 'Parishioner');
        if (totalLikes === 1) {
          likeSummaryText = first;
        } else {
          likeSummaryText = language === 'ar' ? `${first} و ${totalLikes - 1} آخرين` : `${first} and ${totalLikes - 1} others`;
        }
      } else {
        likeSummaryText = language === 'ar' ? `${totalLikes} بركة` : `${totalLikes} ${totalLikes === 1 ? 'blessing' : 'blessings'}`;
      }
    }
  }

  return (
    <div
      id={`post-card-${post.id}`}
      className="p-4 sm:p-5 rounded-2xl bg-[#fffdfa] dark:bg-[#1f1914] border border-(--ln-gold)/40 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden"
    >
      {/* Reshare Header Banner */}
      {post.isReshared && (
        <div className="flex items-center gap-1.5 text-xs text-(--tx-soft) dark:text-(--ac-gold-tx) font-medium mb-3 pb-2 border-b border-(--ln-gold)/20 font-serif">
          <Repeat className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'تمت إعادة المشاركة في خلاصة الرعية' : 'Reshared to the Parish Feed'}</span>
        </div>
      )}

      {/* Post Header */}
      <div className="flex items-start justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div
            className="relative cursor-pointer group"
            onClick={() =>
              onSelectUser?.({
                id: authorId,
                name: authorName,
                avatar: authorAvatar,
                parish: authorParish,
              })
            }
          >
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-10 h-10 rounded-full object-cover border-2 border-(--ln-gold) group-hover:scale-105 transition-transform"
            />
            <div className="absolute -bottom-1 -right-1 rtl:-right-auto rtl:-left-1 w-4 h-4 rounded-full bg-(--chip-dark) text-(--ac-gold-tx) border border-(--ln-gold) flex items-center justify-center text-[8px]">
              ☨
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className="font-serif-coptic font-bold text-xs sm:text-sm text-(--tx-strong) dark:text-[#f5ebd9] uppercase tracking-wider cursor-pointer hover:underline hover:text-(--ac-gold-tx) transition-colors"
                onClick={() =>
                  onSelectUser?.({
                    id: authorId,
                    name: authorName,
                    avatar: authorAvatar,
                    parish: authorParish,
                  })
                }
              >
                {authorName}
              </h4>

              {currentProfile?.full_name?.toLowerCase() !== authorName.toLowerCase() && (
                <div className="flex items-center gap-1.5">
                  {onToggleFollow && (
                    <button
                      type="button"
                      onClick={() => onToggleFollow(authorName)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                        isFollowed
                          ? 'bg-(--bg-soft) dark:bg-[#282019] text-(--tx-mute) border border-(--ln-gold)'
                          : 'bg-(--ac-bronze) hover:bg-(--ac-bronze-dk) text-white shadow-sm'
                      }`}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck className="w-3 h-3 text-(--ac-bronze-tx)" />
                          <span>{t('following')}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>{t('follow')}</span>
                        </>
                      )}
                    </button>
                  )}

                  {onOpenMessengerWithUser && (
                    <button
                      type="button"
                      onClick={() => onOpenMessengerWithUser(authorId || authorName)}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 bg-(--chip-dark) dark:bg-[#282019] text-(--ac-gold-tx) hover:bg-(--ac-bronze) hover:text-white border border-(--ln-gold) transition-all cursor-pointer shadow-sm"
                      title={language === 'ar' ? 'إرسال رسالة خاصة' : 'Send message'}
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رسالة' : 'Message'}</span>
                    </button>
                  )}
                </div>
              )}

              <TimeAgo
                date={post.createdAt || rawPost.created_at}
                prefix="· "
                className="text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif uppercase tracking-wider font-semibold"
              />
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              <Church className="w-3 h-3 text-(--ac-gold-tx)" />
              <p className="text-[10px] text-(--tx-mute) dark:text-[#a89379] font-serif uppercase tracking-wider font-semibold">
                {authorParish}
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-1">
          {postContent && postContent.length > 20 && (
            <button
              type="button"
              onClick={toggleTextToSpeech}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-serif font-bold transition-all cursor-pointer shadow-xs border ${
                isSpeaking
                  ? 'bg-red-700 text-white border-red-800 animate-pulse'
                  : 'bg-(--ac-gold) text-white border-[#b08b43] hover:bg-(--ac-gold-deep)'
              }`}
              title={isSpeaking ? (language === 'ar' ? 'إيقاف الصوت' : 'Stop Audio') : (language === 'ar' ? 'استمع إلى التأمل بصوت مسموع' : 'Listen to Reflection')}
            >
              {isSpeaking ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenReport('post', post.id, authorName, postContent || 'Post Media Content')}
            className="p-1.5 rounded-lg text-(--tx-mute) hover:text-(--tx-strong) hover:bg-(--bg-deep) transition-colors cursor-pointer"
            title={t('report')}
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {isSuperAdminOrAuthor && onDeletePost && (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              className="p-1.5 rounded-lg text-(--tx-mute) hover:text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
              title={t('delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Text */}
      {postContent && (
        <p className="text-xs sm:text-sm text-(--tx-strong) dark:text-[#f5ebd9] font-serif leading-relaxed mb-3.5 whitespace-pre-wrap">
          {postContent}
        </p>
      )}

      {/* Video Media */}
      {parsedEmbed ? (
        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-(--ln-gold)/40 mb-3.5">
          {parsedEmbed.type === 'youtube' || parsedEmbed.type === 'vimeo' ? (
            <iframe
              src={parsedEmbed.embedUrl}
              title="Video"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={parsedEmbed.embedUrl} controls playsInline className="w-full h-full object-contain bg-black" />
          )}
        </div>
      ) : cleanVideoId ? (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-(--ln-gold)/40 mb-3.5 flex items-center justify-center">
          {!isVideoLoaded && (
            <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center z-10 p-4 text-center">
              <img
                src={`https://${cdnHost}/${cleanVideoId}/thumbnail.jpg`}
                alt="Video thumbnail"
                className="absolute inset-0 w-full h-full object-cover opacity-30 filter blur-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <Sparkles className="w-7 h-7 text-(--ac-gold-tx) animate-spin mb-2 z-10" />
              <p className="text-xs text-(--chip-light) font-serif z-10">
                {language === 'ar' ? 'جارٍ تحميل الفيديو...' : 'Loading video stream...'}
              </p>
            </div>
          )}
          <iframe
            src={`https://iframe.mediadelivery.net/embed/${libraryId}/${cleanVideoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`}
            onLoad={() => setIsVideoLoaded(true)}
            className="w-full h-full border-0 relative z-10"
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
            allowFullScreen={true}
            title="Bunny Stream Video"
          />
        </div>
      ) : hasGenericVideo && genericVideoSource ? (
        <div className="mb-3.5">
          <BroadcastCard
            videoUrl={genericVideoSource}
            title={postContent || (language === 'ar' ? 'بث الكنيسة' : 'Parish Broadcast')}
            authorName={authorName}
            authorParish={authorParish}
            mediaId={`post-video-${post.id}`}
          />
        </div>
      ) : null}

      {/* Image Media */}
      {postImage && (!cleanVideoId && !parsedEmbed || rawPost.show_image_with_video) && (
        <div className="rounded-2xl overflow-hidden mb-3.5 border-2 border-(--ln-gold)/40 bg-(--chip-dark)/10 w-full max-h-[500px] flex items-center justify-center shadow-inner">
          <img
            src={postImage}
            alt="Post media"
            loading="lazy"
            className="w-full h-auto max-h-[500px] object-cover rounded-2xl"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Audio Media */}
      {hasAudio && audioSource && (
        <div className="mb-3.5">
          <AudioPlayer
            audioUrl={audioSource}
            title={post.text ? post.text.slice(0, 40) + '...' : language === 'ar' ? 'ترتيلة روحية / عظة' : 'Spiritual Chant / Sermon'}
            authorName={post.authorName}
            mediaId={`post-audio-${post.id}`}
          />
        </div>
      )}

      {/* Quoted Sub-Post */}
      {post.quotedPost && (
        <div className="p-3 mb-3.5 rounded-xl bg-(--bg-inset2) dark:bg-[#282019] border border-(--ln-bright)/30 text-xs space-y-1.5 shadow-sm">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={() =>
              onSelectUser?.({
                name: post.quotedPost!.authorName,
                avatar: post.quotedPost!.authorAvatar,
                parish: post.quotedPost!.authorParish,
              })
            }
          >
            <img
              src={post.quotedPost.authorAvatar}
              alt={post.quotedPost.authorName}
              className="w-5 h-5 rounded-full object-cover border border-(--ln-bright)"
            />
            <span className="font-bold text-(--tx-head) dark:text-(--ac-gold-tx) hover:underline">
              {post.quotedPost.authorName}
            </span>
            <span className="text-[10px] text-(--tx-soft) dark:text-[#a89379]">
              • {post.quotedPost.authorParish}
            </span>
          </div>
          <p className="text-(--tx-body) dark:text-(--chip-light) italic pl-7 rtl:pl-0 rtl:pr-7">
            "{post.quotedPost.text}"
          </p>
        </div>
      )}

      {/* Likes Preview & Interaction Header */}
      <div className="flex items-center justify-between pt-2.5 pb-1 px-1 text-[11px] text-(--tx-soft) dark:text-(--ac-gold-tx) border-t border-(--ln-bright)/15">
        <button
          type="button"
          onClick={handleOpenLikesModal}
          className="flex items-center gap-1.5 hover:underline cursor-pointer group text-left rtl:text-right"
          title={language === 'ar' ? 'عرض من بارك هذا المنشور' : 'See who blessed this'}
        >
          <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
            <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-xs text-[10px] z-10">
              ❤️
            </span>
            {likers &&
              likers.length > 0 &&
              likers.slice(0, 3).map((l, i) => (
                <img
                  key={i}
                  src={l.userAvatar || l.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                  alt={l.userName || l.name || 'Liker'}
                  className="w-5 h-5 rounded-full border border-white dark:border-[#1f1914] object-cover"
                />
              ))}
          </div>
          <span className="font-medium text-(--tx-head) dark:text-[#e6d5b8] group-hover:text-(--ac-gold-tx) transition-colors">
            {totalLikes > 0 ? likeSummaryText : language === 'ar' ? 'كن أول من يبارك' : 'Be the first to bless'}
          </span>
        </button>

        <div className="flex items-center gap-3 text-(--tx-soft) dark:text-[#a89379]">
          {(post.commentsCount || 0) > 0 && (
            <button
              type="button"
              onClick={onToggleComments}
              className="hover:underline cursor-pointer hover:text-(--tx-head) dark:hover:text-[#e6d5b8] transition-colors"
            >
              {post.commentsCount} {language === 'ar' ? 'تعليق' : post.commentsCount === 1 ? 'comment' : 'comments'}
            </button>
          )}
          {(post.resharesCount || 0) > 0 && (
            <span className="hidden sm:inline">
              {post.resharesCount} {language === 'ar' ? 'مشاركة' : post.resharesCount === 1 ? 'reshare' : 'reshares'}
            </span>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-(--ln-bright)/20 text-xs">
        <button
          type="button"
          onClick={handleLikeClick}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
            isLiked
              ? 'bg-rose-50 dark:bg-rose-950/30 text-red-600 font-bold border border-rose-200 dark:border-rose-900/40 shadow-xs'
              : 'text-(--tx-soft) hover:text-red-600 hover:bg-(--bg-inset) dark:hover:bg-[#282019]'
          }`}
          title={language === 'ar' ? (isLiked ? 'إلغاء البركة' : 'مباركة التأمل') : isLiked ? 'Unlike reflection' : 'Bless reflection'}
        >
          <Heart className={`w-4 h-4 transition-transform ${isLiked ? 'fill-current text-red-600 scale-110' : 'group-hover:scale-110'}`} />
          <span className="font-serif font-semibold">
            {language === 'ar' ? (isLiked ? 'مُبارك' : 'تبارك') : isLiked ? 'Blessed' : 'Bless'}
          </span>
          <span className="text-[11px] font-bold opacity-90">({totalLikes})</span>
        </button>

        <button
          type="button"
          onClick={onToggleComments}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-colors cursor-pointer select-none ${
            isCommentsOpen
              ? 'bg-(--bg-inset) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] font-bold'
              : 'text-(--tx-soft) hover:text-(--tx-head) hover:bg-(--bg-inset) dark:hover:bg-[#282019]'
          }`}
          title={language === 'ar' ? 'التأملات والتعليقات' : 'Reflections & Comments'}
        >
          <MessageCircle className="w-4 h-4 text-(--ac-bright-tx)" />
          <span className="font-serif font-semibold">{language === 'ar' ? 'تعليق' : 'Comment'}</span>
          {(post.commentsCount || 0) > 0 && (
            <span className="text-[11px] opacity-80">({post.commentsCount})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onReshare(post)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-(--tx-soft) hover:text-(--tx-head) hover:bg-(--bg-inset) dark:hover:bg-[#282019] transition-colors cursor-pointer select-none"
          title={language === 'ar' ? 'إعادة مشاركة في الخلاصة' : 'Reshare to Feed'}
        >
          <Repeat className="w-4 h-4 text-(--ac-bright-tx)" />
          <span className="font-serif font-semibold hidden sm:inline">
            {language === 'ar' ? 'مشاركة' : 'Reshare'}
          </span>
          {(post.resharesCount || 0) > 0 && (
            <span className="text-[11px] opacity-80">({post.resharesCount})</span>
          )}
        </button>

        {onOpenMessengerWithUser && (
          <button
            type="button"
            onClick={() => onOpenMessengerWithUser(post.authorId || post.authorName)}
            className="p-2 rounded-xl text-(--tx-soft) hover:text-(--tx-strong) hover:bg-(--bg-inset) dark:hover:bg-[#282019] transition-colors cursor-pointer"
            title={language === 'ar' ? 'رسالة خاصة' : 'Direct Message'}
          >
            <MessageSquare className="w-4 h-4 text-(--ac-bronze-tx)" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`https://orthodoxconnect.live/post/${post.id}`);
          }}
          className="p-2 text-(--tx-soft) hover:text-(--tx-head) hover:bg-(--bg-inset) dark:hover:bg-[#282019] rounded-xl transition-colors cursor-pointer"
          title={language === 'ar' ? 'نسخ رابط المنشور' : 'Copy link to post'}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Comments Section */}
      {isCommentsOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-(--ln-bright)/20 space-y-3">
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {formattedComments.length === 0 ? (
              <div className="text-center py-4 text-(--tx-soft) dark:text-[#a89379] italic text-xs">
                {language === 'ar'
                  ? 'لم تتم مشاركة أي تأملات بعد. كن أول من يشارك أفكاره!'
                  : 'No reflections shared yet. Be the first to share your thoughts!'}
              </div>
            ) : (
              formattedComments.map((comm) => {
                const isCommentAuthor =
                  Boolean(currentProfile?.id && comm.user_id && currentProfile.id === comm.user_id) ||
                  Boolean(currentProfile?.full_name && comm.author_name === currentProfile.full_name);
                const canDelete = isCommentAuthor || isSuperAdminOrAuthor;

                return (
                  <div key={comm.id} className="flex items-start gap-2.5 group">
                    <img
                      src={comm.author_avatar || comm.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                      alt={comm.author_name || comm.authorName || 'User'}
                      className="w-8 h-8 rounded-full object-cover border border-(--ln-gold)/40 mt-0.5 shrink-0 cursor-pointer"
                      onClick={() =>
                        onSelectUser?.({
                          id: comm.user_id || comm.userId,
                          name: comm.author_name || comm.authorName || 'Parishioner',
                          avatar: comm.author_avatar || comm.authorAvatar || '',
                          parish: 'Orthodox Church',
                        })
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="p-3 rounded-2xl bg-(--bg-inset2) dark:bg-[#282019] border border-(--ln-bright)/20 shadow-xs inline-block max-w-full">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9] hover:underline cursor-pointer font-serif"
                            onClick={() =>
                              onSelectUser?.({
                                id: comm.user_id || comm.userId,
                                name: comm.author_name || comm.authorName || 'Parishioner',
                                avatar: comm.author_avatar || comm.authorAvatar || '',
                                parish: 'Orthodox Church',
                              })
                            }
                          >
                            {comm.author_name || comm.authorName || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner')}
                          </span>
                          <span className="text-[10px] text-(--tx-soft) dark:text-[#a89379]">
                            <TimeAgo dateString={comm.created_at || comm.createdAt || ''} />
                          </span>
                        </div>
                        <p className="text-xs text-(--tx-body) dark:text-(--chip-light) whitespace-pre-line break-words">
                          {comm.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pl-2 rtl:pl-0 rtl:pr-2 pt-1 text-[10px] text-(--tx-soft) dark:text-[#a89379]">
                        {canDelete && onDeleteComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(post.id, comm.id)}
                            className="hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                            title={t('delete')}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t('delete')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onOpenReport('comment', comm.id, comm.author_name || 'Member', comm.content)
                          }
                          className="hover:text-amber-700 transition-colors flex items-center gap-1 cursor-pointer opacity-0 group-hover:opacity-100"
                          title={t('report')}
                        >
                          <Flag className="w-3 h-3" />
                          <span>{t('report')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1.5">
            <img
              src={currentProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt="You"
              className="w-8 h-8 rounded-full object-cover border border-(--ln-gold) shrink-0"
            />
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب تأملاً أو تعليقاً...' : 'Write a reflection or comment...'}
                className="w-full pl-3 pr-10 rtl:pl-10 rtl:pr-3 py-2 rounded-xl bg-(--bg-inset2) dark:bg-[#282019] border border-(--ln-bright)/30 text-xs text-(--tx-body) dark:text-[#f5ebd9] placeholder-(--tx-soft)/60 focus:outline-none focus:border-(--ln-bright) focus:ring-1 focus:ring-(--ac-bright)/50"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="absolute right-1.5 rtl:right-auto rtl:left-1.5 p-1.5 rounded-lg bg-gradient-to-r from-(--ac-gold) to-(--ac-bronze-dk) hover:from-(--bg-deep) hover:to-(--ac-gold) disabled:opacity-30 disabled:cursor-not-allowed text-(--tx-ink) cursor-pointer shadow-xs transition-all rtl:rotate-180"
                title={t('send')}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Likes Modal with Complete List of Users */}
      {showLikesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fffdfa] dark:bg-[#1f1914] border border-(--ln-gold)/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-(--ln-gold)/20 bg-[#f5ebd9]/30 dark:bg-[#282019]">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-xs text-xs">
                  ❤️
                </span>
                <h3 className="font-serif font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
                  {language === 'ar'
                    ? `الذين باركوا هذا التأمل (${modalLikers.length || totalLikes})`
                    : `People who blessed this reflection (${modalLikers.length || totalLikes})`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLikesModal(false)}
                className="p-1 rounded-lg text-(--tx-soft) hover:text-(--tx-strong) hover:bg-(--ac-gold)/15 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-(--ln-gold)/10 space-y-2">
              {isLoadingLikers ? (
                <div className="py-6 text-center text-xs text-(--tx-soft) dark:text-(--ac-gold-tx) animate-pulse">
                  {language === 'ar' ? 'جارٍ تحميل أبناء الرعية...' : 'Loading parishioners...'}
                </div>
              ) : modalLikers.length === 0 ? (
                <div className="py-6 text-center text-xs text-(--tx-soft) dark:text-[#a89379]">
                  {totalLikes > 0
                    ? language === 'ar'
                      ? `${totalLikes} أعضاء باركوا هذا التأمل`
                      : `${totalLikes} parishioners blessed this reflection`
                    : language === 'ar'
                    ? 'لا توجد بركات بعد'
                    : 'No blessings yet'}
                </div>
              ) : (
                modalLikers.map((liker, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 pt-2 cursor-pointer hover:bg-(--ac-gold)/10 rounded-xl px-2 transition-colors"
                    onClick={() => {
                      setShowLikesModal(false);
                      onSelectUser?.({
                        id: liker.userId || liker.id,
                        name: liker.userName || liker.name || 'Parishioner',
                        avatar: liker.userAvatar || liker.avatar || '',
                        parish: liker.parish || 'Orthodox Parish',
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={liker.userAvatar || liker.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                        alt={liker.userName || liker.name || 'User'}
                        className="w-9 h-9 rounded-full object-cover border border-(--ln-gold)"
                      />
                      <div>
                        <div className="font-serif font-bold text-xs text-(--tx-strong) dark:text-[#f5ebd9]">
                          {liker.userName || liker.name || 'Orthodox Parishioner'}
                        </div>
                        <div className="text-[10px] text-(--tx-soft) dark:text-[#a89379]">
                          {liker.userId === currentProfile?.id
                            ? language === 'ar'
                              ? 'أنت'
                              : 'You'
                            : liker.parish || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner')}
                        </div>
                      </div>
                    </div>
                    {onOpenMessengerWithUser && liker.userId !== currentProfile?.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLikesModal(false);
                          onOpenMessengerWithUser(liker.userId || liker.id || liker.userName);
                        }}
                        className="p-1.5 rounded-lg text-(--tx-soft) hover:text-(--tx-strong) hover:bg-(--ac-gold)/20 transition-colors"
                        title={language === 'ar' ? 'إرسال رسالة' : 'Send Message'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
