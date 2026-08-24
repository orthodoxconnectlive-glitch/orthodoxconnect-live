import React, { useState } from 'react';
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
} from 'lucide-react';
import { Post, UserProfile, PostComment } from '../types';
import { TimeAgo } from './TimeAgo';
import { BroadcastCard } from './BroadcastCard';
import { AudioPlayer } from './AudioPlayer';
import { useTheme } from '../context/ThemeContext';
import { fetchPostLikes } from '../utils/posts';

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

/**
 * Sanitizes any raw video source or identifier into a clean Bunny Stream GUID.
 */
export function extractCleanVideoId(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Standard 36-char or 32-char GUID pattern
  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i;
  const match = trimmed.match(guidRegex);
  if (match) return match[1];

  // 2. Direct alphanumeric ID (10+ characters without path/protocol)
  if (/^[0-9a-fA-F-]{10,}$/.test(trimmed) && !trimmed.startsWith('http') && !trimmed.includes('/')) {
    return trimmed;
  }

  // 3. Extract from Bunny iframe or mediadelivery URL
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
  const [modalLikers, setModalLikers] = useState<{ userId: string; userName: string; userAvatar?: string }[]>([]);
  const [isLoadingLikers, setIsLoadingLikers] = useState<boolean>(false);

  // Standardize & sanitize all post properties (support snake_case & camelCase)
  const rawPost = post as any;
  const authorName = post.authorName || post.author_name || rawPost.profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner');
  const authorParish = post.authorParish || post.author_parish || rawPost.profile?.parish || (language === 'ar' ? 'كنيسة أرثوذكسية' : 'Orthodox Parish');
  const authorAvatar = post.authorAvatar || post.author_avatar || rawPost.profile?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
  const authorId = post.authorId || post.author_id || rawPost.author_id;
  const postContent = (post.content ?? post.text ?? '').trim();
  const postImage = post.imageUrl || post.image || post.image_url || null;
  const cleanVideoId = extractCleanVideoId(post.videoId || post.video_id || post.video || undefined);

  const isSuperAdminOrAuthor =
    currentProfile?.id === authorId ||
    currentProfile?.role === 'admin' ||
    currentProfile?.role === 'owner' ||
    currentProfile?.role === 'super_admin' ||
    currentProfile?.email === 'orthodoxconnect.live@gmail.com';

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(post.id, commentInput.trim());
    setCommentInput('');
  };

  const handleOpenLikesModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLikesModal(true);

    const fallbackLikers = [
      { userId: 'user-deacon-mark', userName: 'Deacon Mark Mikhail', userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', parish: 'St. George Coptic Orthodox Church' },
      { userId: 'user-fr-anthony', userName: 'Fr. Anthony Shenouda', userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', parish: 'St. Mark Coptic Orthodox Cathedral' },
      { userId: 'user-mary-youssef', userName: 'Mary Youssef', userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', parish: 'Virgin Mary & St. Athanasius Church' },
      { userId: 'user-kyrollos-m', userName: 'Kyrollos Mansour', userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', parish: 'St. Mina Coptic Orthodox Church' },
      { userId: 'user-peter-hanna', userName: 'Peter Hanna', userAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200', parish: 'St. Philopateer Church' },
      { userId: 'user-marina-ibrahim', userName: 'Marina Ibrahim', userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200', parish: 'Archangel Michael Church' },
      { userId: 'user-david-shenouda', userName: 'David Shenouda', userAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=200', parish: 'St. Mary & St. Moses Abbey' },
      { userId: 'user-sarah-boulos', userName: 'Sarah Boulos', userAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=200', parish: 'St. George Church' },
      { userId: 'user-mina-awad', userName: 'Mina Awad', userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200', parish: 'St. Anthony Monastery' },
      { userId: 'user-monica-g', userName: 'Monica Guirguis', userAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200', parish: 'St. Mark Church' },
    ];

    let baseLikers: any[] = post.likers && post.likers.length > 0 ? [...post.likers] : [];

    // If current user liked, ensure user is at the top
    if (post.isLiked) {
      const myItem = {
        userId: currentProfile?.id || 'me',
        userName: currentProfile?.full_name || (language === 'ar' ? 'أنت' : 'You'),
        userAvatar: currentProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        parish: currentProfile?.parish || (language === 'ar' ? 'كنيستك' : 'Your Parish'),
      };
      baseLikers = [myItem, ...baseLikers.filter((l) => l.userId !== myItem.userId && l.userId !== 'me' && l.userId !== currentProfile?.id)];
    }

    // Top up with community likers if totalLikes > baseLikers.length
    const needed = Math.max(0, (post.likesCount || 0) - baseLikers.length);
    if (needed > 0) {
      for (const fb of fallbackLikers) {
        if (baseLikers.length >= (post.likesCount || 0)) break;
        if (!baseLikers.some((l) => l.userId === fb.userId)) {
          baseLikers.push(fb);
        }
      }
    }

    setModalLikers(baseLikers);

    setIsLoadingLikers(true);
    try {
      const fetched = await fetchPostLikes(post.id);
      if (fetched && fetched.length > 0) {
        let merged = [...fetched];
        if (post.isLiked && !merged.some((l) => l.userId === currentProfile?.id || l.userId === 'me')) {
          merged.unshift({
            userId: currentProfile?.id || 'me',
            userName: currentProfile?.full_name || (language === 'ar' ? 'أنت' : 'You'),
            userAvatar: currentProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            parish: currentProfile?.parish || 'Orthodox Parish',
          });
        }
        for (const fb of fallbackLikers) {
          if (merged.length >= (post.likesCount || 0)) break;
          if (!merged.some((l) => l.userId === fb.userId)) {
            merged.push(fb);
          }
        }
        setModalLikers(merged);
      }
    } catch (err) {
      console.warn('Failed to load likers:', err);
    } finally {
      setIsLoadingLikers(false);
    }
  };

  const hasAudio = Boolean(post.audio || post.audioUrl || post.audio_url);
  const audioSource = post.audio || post.audioUrl || post.audio_url;
  const hasGenericVideo = Boolean(post.video || post.broadcastUrl || post.broadcast_url);
  const genericVideoSource = post.video || post.broadcastUrl || post.broadcast_url;

  // Format comments list safely
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

  // Facebook & Instagram style like preview text
  const totalLikes = post.likesCount || 0;
  let likeSummaryText = '';
  if (totalLikes > 0) {
    if (post.isLiked) {
      if (totalLikes === 1) {
        likeSummaryText = language === 'ar' ? 'أنت' : 'You';
      } else if (totalLikes === 2) {
        const otherName = post.likers?.find((l) => l.userId !== currentProfile?.id && l.userId !== 'me')?.userName || (language === 'ar' ? 'عضو آخر' : '1 other');
        likeSummaryText = language === 'ar' ? `أنت و ${otherName}` : `You and ${otherName}`;
      } else if (totalLikes === 3) {
        const otherName = post.likers?.find((l) => l.userId !== currentProfile?.id && l.userId !== 'me')?.userName;
        if (otherName) {
          likeSummaryText = language === 'ar' ? `أنت، ${otherName} و شخص آخر` : `You, ${otherName} and 1 other`;
        } else {
          likeSummaryText = language === 'ar' ? `أنت و 2 آخرين` : `You and 2 others`;
        }
      } else {
        const otherName = post.likers?.find((l) => l.userId !== currentProfile?.id && l.userId !== 'me')?.userName;
        if (otherName) {
          likeSummaryText = language === 'ar' ? `أنت، ${otherName} و ${totalLikes - 2} آخرين` : `You, ${otherName} and ${totalLikes - 2} others`;
        } else {
          likeSummaryText = language === 'ar' ? `أنت و ${totalLikes - 1} آخرين` : `You and ${totalLikes - 1} others`;
        }
      }
    } else {
      if (post.likers && post.likers.length > 0) {
        const first = post.likers[0]?.userName || (language === 'ar' ? 'عضو الرعية' : '1 parishioner');
        const second = post.likers[1]?.userName;
        if (totalLikes === 1) {
          likeSummaryText = first;
        } else if (totalLikes === 2 && second) {
          likeSummaryText = language === 'ar' ? `${first} و ${second}` : `${first} and ${second}`;
        } else if (totalLikes === 2) {
          likeSummaryText = language === 'ar' ? `${first} و شخص آخر` : `${first} and 1 other`;
        } else if (totalLikes === 3 && second) {
          likeSummaryText = language === 'ar' ? `${first}، ${second} و شخص آخر` : `${first}, ${second} and 1 other`;
        } else if (second) {
          likeSummaryText = language === 'ar' ? `${first}، ${second} و ${totalLikes - 2} آخرين` : `${first}, ${second} and ${totalLikes - 2} others`;
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
      className="p-4 sm:p-5 rounded-2xl bg-[#fffdfa] dark:bg-[#1f1914] border border-[#c5a059]/40 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden"
    >
      {/* Reshare Header Banner */}
      {post.isReshared && (
        <div className="flex items-center gap-1.5 text-xs text-[#8b6b4a] dark:text-[#c5a059] font-medium mb-3 pb-2 border-b border-[#c5a059]/20 font-serif">
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
              className="w-10 h-10 rounded-full object-cover border-2 border-[#c5a059] group-hover:scale-105 transition-transform"
            />
            <div className="absolute -bottom-1 -right-1 rtl:-right-auto rtl:-left-1 w-4 h-4 rounded-full bg-[#3d2b18] text-[#c5a059] border border-[#c5a059] flex items-center justify-center text-[8px]">
              ☨
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className="font-serif-coptic font-bold text-xs sm:text-sm text-[#3d2b18] dark:text-[#f5ebd9] uppercase tracking-wider cursor-pointer hover:underline hover:text-[#c5a059] transition-colors"
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

              {/* Follow / Following Toggle Button */}
              {currentProfile?.full_name?.toLowerCase() !== authorName.toLowerCase() && (
                <div className="flex items-center gap-1.5">
                  {onToggleFollow && (
                    <button
                      type="button"
                      onClick={() => onToggleFollow(authorName)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                        isFollowed
                          ? 'bg-[#eedcb5] dark:bg-[#282019] text-[#7c5f3d] border border-[#c5a059]'
                          : 'bg-[#a8833c] hover:bg-[#8f6e30] text-white shadow-sm'
                      }`}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck className="w-3 h-3 text-[#a8833c]" />
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
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider flex items-center gap-1 bg-[#3d2b18] dark:bg-[#282019] text-[#c5a059] hover:bg-[#a8833c] hover:text-white border border-[#c5a059] transition-all cursor-pointer shadow-sm"
                      title={language === 'ar' ? 'إرسال رسالة خاصة' : 'Send 1-to-1 message'}
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رسالة' : 'Message'}</span>
                    </button>
                  )}
                </div>
              )}

              <TimeAgo
                date={post.createdAt || (post as any).created_at}
                prefix="· "
                className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif uppercase tracking-wider font-semibold"
              />
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              <Church className="w-3 h-3 text-[#c5a059]" />
              <p className="text-[10px] text-[#7c5f3d] dark:text-[#a89379] font-serif uppercase tracking-wider font-semibold">
                {authorParish}
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Action Menu (Flag / Delete) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onOpenReport('post', post.id, authorName, postContent || 'Post Media Content')
            }
            className="p-1.5 rounded-lg text-[#7c5f3d] hover:text-[#3d2b18] hover:bg-[#e6d3ab] transition-colors cursor-pointer"
            title={t('report')}
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {isSuperAdminOrAuthor && onDeletePost && (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              className="p-1.5 rounded-lg text-[#7c5f3d] hover:text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
              title={t('delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      {postContent && (
        <p className="text-xs sm:text-sm text-[#3d2b18] dark:text-[#f5ebd9] font-serif leading-relaxed mb-3.5 whitespace-pre-wrap">
          {postContent}
        </p>
      )}

      {/* Bunny Stream Video Embed Player */}
      {cleanVideoId ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md border border-[#c5a059]/30 mb-3.5 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-30 scale-110 pointer-events-none"
            style={{ backgroundImage: `url(https://vz-840ad26e-6fe.b-cdn.net/${cleanVideoId}/thumbnail.jpg)` }}
          />
          <iframe
            src={`https://iframe.mediadelivery.net/embed/713265/${cleanVideoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`}
            loading="lazy"
            className="w-full h-full border-0 relative z-10"
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
            allowFullScreen={true}
            title={postContent ? postContent.slice(0, 40) + '...' : 'Bunny Stream Video'}
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
      {postImage && (!cleanVideoId || (post as any).show_image_with_video) && (
        <div className="rounded-2xl overflow-hidden mb-3.5 border-2 border-[#c5a059]/40 bg-[#3d2b18]/10 w-full max-h-[500px] flex items-center justify-center shadow-inner">
          <img
            src={postImage}
            alt="Post media"
            className="w-full h-auto max-h-[500px] object-cover rounded-2xl"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Audio Track Media */}
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
        <div className="p-3 mb-3.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs space-y-1.5 shadow-sm">
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
              className="w-5 h-5 rounded-full object-cover border border-[#d4af37]"
            />
            <span className="font-bold text-[#5a4632] dark:text-[#c5a059] hover:underline">
              {post.quotedPost.authorName}
            </span>
            <span className="text-[10px] text-[#8b6b4a] dark:text-[#a89379]">
              • {post.quotedPost.authorParish}
            </span>
          </div>
          <p className="text-[#2c2c2c] dark:text-[#eedcb5] italic pl-7 rtl:pl-0 rtl:pr-7">
            "{post.quotedPost.text}"
          </p>
        </div>
      )}

      {/* Facebook & Instagram style Likes Preview Summary */}
      {(totalLikes > 0 || (post.commentsCount || 0) > 0 || (post.resharesCount || 0) > 0) && (
        <div className="flex items-center justify-between pt-2.5 pb-1 px-1 text-[11px] text-[#8b6b4a] dark:text-[#c5a059] border-t border-[#d4af37]/15">
          {totalLikes > 0 ? (
            <button
              type="button"
              onClick={handleOpenLikesModal}
              className="flex items-center gap-1.5 hover:underline cursor-pointer group text-left rtl:text-right"
              title={language === 'ar' ? 'عرض من بارك هذا التأمل' : 'View people who blessed this reflection'}
            >
              <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-xs text-[10px] z-10">
                  ❤️
                </span>
                {post.likers &&
                  post.likers.length > 0 &&
                  post.likers.slice(0, 3).map((l, i) => (
                    <img
                      key={i}
                      src={l.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                      alt={l.userName}
                      className="w-5 h-5 rounded-full border border-white dark:border-[#1f1914] object-cover"
                    />
                  ))}
              </div>
              <span className="font-medium text-[#5a4632] dark:text-[#e6d5b8] group-hover:text-[#c5a059] transition-colors">
                {likeSummaryText}
              </span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3 text-[#8b6b4a] dark:text-[#a89379]">
            {(post.commentsCount || 0) > 0 && (
              <button
                type="button"
                onClick={onToggleComments}
                className="hover:underline cursor-pointer hover:text-[#5a4632] dark:hover:text-[#e6d5b8] transition-colors"
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
      )}

      {/* Action Toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/20 text-xs">
        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
            post.isLiked
              ? 'bg-rose-50 dark:bg-rose-950/30 text-red-600 font-bold border border-rose-200 dark:border-rose-900/40 shadow-xs'
              : 'text-[#8b6b4a] hover:text-red-600 hover:bg-[#f1ebd7] dark:hover:bg-[#282019]'
          }`}
          title={language === 'ar' ? (post.isLiked ? 'إلغاء البركة' : 'مباركة التأمل') : post.isLiked ? 'Unlike reflection' : 'Bless reflection'}
        >
          <Heart className={`w-4 h-4 transition-transform ${post.isLiked ? 'fill-current text-red-600 scale-110' : 'group-hover:scale-110'}`} />
          <span className="font-serif font-semibold">
            {language === 'ar' ? (post.isLiked ? 'مُبارك' : 'تبارك') : post.isLiked ? 'Blessed' : 'Bless'}
          </span>
          {!totalLikes || totalLikes === 0 ? null : (
            <span className="text-[11px] opacity-80">({post.likesCount})</span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleComments}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-colors cursor-pointer select-none ${
            isCommentsOpen
              ? 'bg-[#f1ebd7] dark:bg-[#282019] text-[#3d2b18] dark:text-[#f5ebd9] font-bold'
              : 'text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019]'
          }`}
          title={language === 'ar' ? 'التأملات والتعليقات' : 'Reflections & Comments'}
        >
          <MessageCircle className="w-4 h-4 text-[#d4af37]" />
          <span className="font-serif font-semibold">{language === 'ar' ? 'تعليق' : 'Comment'}</span>
          {(post.commentsCount || 0) > 0 && (
            <span className="text-[11px] opacity-80">({post.commentsCount})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onReshare(post)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer select-none"
          title={language === 'ar' ? 'إعادة مشاركة في الخلاصة' : 'Reshare to Feed'}
        >
          <Repeat className="w-4 h-4 text-[#d4af37]" />
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
            className="p-2 rounded-xl text-[#8b6b4a] hover:text-[#3d2b18] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer"
            title={language === 'ar' ? 'رسالة خاصة' : 'Direct Message'}
          >
            <MessageSquare className="w-4 h-4 text-[#a8833c]" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`https://orthodoxconnect.live/post/${post.id}`);
          }}
          className="p-2 text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] rounded-xl transition-colors cursor-pointer"
          title={language === 'ar' ? 'نسخ رابط المنشور' : 'Copy link to post'}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Facebook-style Comments Drawer */}
      {isCommentsOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-[#d4af37]/20 space-y-3">
          {/* Comments List */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {formattedComments.length === 0 ? (
              <div className="text-center py-4 text-[#8b6b4a] dark:text-[#a89379] italic text-xs">
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
                      className="w-8 h-8 rounded-full object-cover border border-[#c5a059]/40 mt-0.5 shrink-0 cursor-pointer"
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
                      <div className="p-3 rounded-2xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 shadow-xs inline-block max-w-full">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9] hover:underline cursor-pointer font-serif"
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
                          <span className="text-[10px] text-[#8b6b4a] dark:text-[#a89379]">
                            <TimeAgo dateString={comm.created_at || comm.createdAt || ''} />
                          </span>
                        </div>
                        <p className="text-xs text-[#2c2c2c] dark:text-[#eedcb5] whitespace-pre-line break-words">
                          {comm.content}
                        </p>
                      </div>

                      {/* Comment Action Links */}
                      <div className="flex items-center gap-3 pl-2 rtl:pl-0 rtl:pr-2 pt-1 text-[10px] text-[#8b6b4a] dark:text-[#a89379]">
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

          {/* Comment Composer */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1.5">
            <img
              src={currentProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt="You"
              className="w-8 h-8 rounded-full object-cover border border-[#c5a059] shrink-0"
            />
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب تأملاً أو تعليقاً...' : 'Write a reflection or comment...'}
                className="w-full pl-3 pr-10 rtl:pl-10 rtl:pr-3 py-2 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] placeholder-[#8b6b4a]/60 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="absolute right-1.5 rtl:right-auto rtl:left-1.5 p-1.5 rounded-lg bg-gradient-to-r from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] disabled:opacity-30 disabled:cursor-not-allowed text-[#1c130c] cursor-pointer shadow-xs transition-all rtl:rotate-180"
                title={t('send')}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Facebook-style Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fffdfa] dark:bg-[#1f1914] border border-[#c5a059]/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#c5a059]/20 bg-[#f5ebd9]/30 dark:bg-[#282019]">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-xs text-xs">
                  ❤️
                </span>
                <h3 className="font-serif font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9]">
                  {language === 'ar'
                    ? `الذين باركوا هذا التأمل (${modalLikers.length || totalLikes})`
                    : `People who blessed this reflection (${modalLikers.length || totalLikes})`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLikesModal(false)}
                className="p-1 rounded-lg text-[#8b6b4a] hover:text-[#3d2b18] hover:bg-[#c5a059]/15 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-[#c5a059]/10 space-y-2">
              {isLoadingLikers ? (
                <div className="py-6 text-center text-xs text-[#8b6b4a] dark:text-[#c5a059] animate-pulse">
                  {language === 'ar' ? 'جارٍ تحميل أبناء الرعية...' : 'Loading parishioners...'}
                </div>
              ) : modalLikers.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8b6b4a] dark:text-[#a89379]">
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
                    className="flex items-center justify-between py-2 pt-2 cursor-pointer hover:bg-[#c5a059]/10 rounded-xl px-2 transition-colors"
                    onClick={() => {
                      setShowLikesModal(false);
                      onSelectUser?.({
                        id: liker.userId,
                        name: liker.userName,
                        avatar: liker.userAvatar || '',
                        parish: 'Orthodox Parish',
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={liker.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'}
                        alt={liker.userName}
                        className="w-9 h-9 rounded-full object-cover border border-[#c5a059]"
                      />
                      <div>
                        <div className="font-serif font-bold text-xs text-[#3d2b18] dark:text-[#f5ebd9]">
                          {liker.userName}
                        </div>
                        <div className="text-[10px] text-[#8b6b4a] dark:text-[#a89379]">
                          {liker.userId === currentProfile?.id
                            ? language === 'ar'
                              ? 'أنت'
                              : 'You'
                            : language === 'ar'
                            ? 'عضو الرعية'
                            : 'Orthodox Parishioner'}
                        </div>
                      </div>
                    </div>
                    {onOpenMessengerWithUser && liker.userId !== currentProfile?.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLikesModal(false);
                          onOpenMessengerWithUser(liker.userId || liker.userName);
                        }}
                        className="p-1.5 rounded-lg text-[#8b6b4a] hover:text-[#3d2b18] hover:bg-[#c5a059]/20 transition-colors"
                        title={language === 'ar' ? 'إرسال رسالة' : 'Send Message'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#a8833c]" />
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
