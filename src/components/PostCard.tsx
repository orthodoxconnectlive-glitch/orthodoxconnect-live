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
} from 'lucide-react';
import { Post, UserProfile } from '../types';
import { TimeAgo } from './TimeAgo';
import { BroadcastCard } from './BroadcastCard';
import { AudioPlayer } from './AudioPlayer';
import { useTheme } from '../context/ThemeContext';

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
  comments?: string[];
  isCommentsOpen: boolean;
  onToggleComments: () => void;
  onAddComment: (postId: string, commentText: string) => void;
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
}) => {
  const { t } = useTheme();
  const [commentInput, setCommentInput] = useState<string>('');

  // Standardize & sanitize all post properties (support snake_case & camelCase)
  const rawPost = post as any;
  const authorName = post.authorName || rawPost.author_name || 'Orthodox Parishioner';
  const authorParish = post.authorParish || rawPost.author_parish || 'Orthodox Parish';
  const authorAvatar = post.authorAvatar || rawPost.author_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
  const authorId = post.authorId || rawPost.author_id;
  const postContent = post.text || rawPost.content || '';
  const postImage = post.image || rawPost.image_url || rawPost.photo_url;
  const rawVideo = post.video_id || rawPost.video_id || post.video || rawPost.videoId || rawPost.video_url;
  const cleanVideoId = extractCleanVideoId(rawVideo);

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

  const hasAudio = Boolean(post.audio || post.audioUrl || rawPost.audio_url);
  const audioSource = post.audio || post.audioUrl || rawPost.audio_url;
  const hasGenericVideo = Boolean(post.video || post.broadcastUrl || rawPost.broadcast_url);
  const genericVideoSource = post.video || post.broadcastUrl || rawPost.broadcast_url;

  return (
    <div
      id={`post-card-${post.id}`}
      className="p-4 sm:p-5 rounded-2xl bg-[#fffdfa] dark:bg-[#1f1914] border border-[#c5a059]/40 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden"
    >
      {/* Reshare Header Banner */}
      {post.isReshared && (
        <div className="flex items-center gap-1.5 text-xs text-[#8b6b4a] dark:text-[#c5a059] font-medium mb-3 pb-2 border-b border-[#c5a059]/20 font-serif">
          <Repeat className="w-3.5 h-3.5" />
          <span>Reshared to the Parish Feed</span>
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
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#3d2b18] text-[#c5a059] border border-[#c5a059] flex items-center justify-center text-[8px]">
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
                      title="Send 1-to-1 message"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Message</span>
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
            title="Flag / Report Content"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {isSuperAdminOrAuthor && onDeletePost && (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              className="p-1.5 rounded-lg text-[#7c5f3d] hover:text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
              title="Delete Post"
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
          {/* Ambient blurred backdrop */}
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
            title={postContent ? (postContent.slice(0, 40) + '...') : 'Bunny Stream Video'}
          />
        </div>
      ) : hasGenericVideo && genericVideoSource ? (
        <div className="mb-3.5">
          <BroadcastCard
            videoUrl={genericVideoSource}
            title={postContent || 'Parish Broadcast'}
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

      {/* Audio Track Media: AutoPlay Stripped, Explicit Play Required */}
      {hasAudio && audioSource && (
        <div className="mb-3.5">
          <AudioPlayer
            audioUrl={audioSource}
            title={post.text ? (post.text.slice(0, 40) + '...') : 'Spiritual Chant / Sermon'}
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
          <p className="text-[#2c2c2c] dark:text-[#eedcb5] italic pl-7">
            "{post.quotedPost.text}"
          </p>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex items-center justify-between pt-3 border-t border-[#d4af37]/20 text-xs">
        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
            post.isLiked
              ? 'bg-red-100 text-red-600 font-bold border border-red-200'
              : 'text-[#8b6b4a] hover:text-red-600 hover:bg-[#f1ebd7] dark:hover:bg-[#282019]'
          }`}
        >
          <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current text-red-600' : ''}`} />
          <span>{post.likesCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={onToggleComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-[#d4af37]" />
          <span>{post.commentsCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onReshare(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer"
        >
          <Repeat className="w-4 h-4 text-[#d4af37]" />
          <span>{post.resharesCount || 0}</span>
        </button>

        {onOpenMessengerWithUser && (
          <button
            type="button"
            onClick={() => onOpenMessengerWithUser(post.authorId || post.authorName)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#8b6b4a] hover:text-[#3d2b18] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] transition-colors cursor-pointer font-serif font-semibold"
            title="Direct Message 1-on-1"
          >
            <MessageSquare className="w-4 h-4 text-[#a8833c]" />
            <span className="hidden sm:inline">Message</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`https://orthodoxconnect.live/post/${post.id}`);
          }}
          className="p-1.5 text-[#8b6b4a] hover:text-[#5a4632] hover:bg-[#f1ebd7] dark:hover:bg-[#282019] rounded-xl transition-colors cursor-pointer"
          title="Copy link to post"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Comments Drawer */}
      {isCommentsOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-[#d4af37]/20 space-y-2.5">
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-[11px] text-[#8b6b4a] italic">
                No reflections shared yet. Be the first to share your thoughts!
              </p>
            ) : (
              comments.map((cText, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/20 text-[11px] text-[#2c2c2c] dark:text-[#f5ebd9] flex items-center justify-between shadow-sm"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-[#5a4632] dark:text-[#c5a059] mr-1.5 font-serif">
                      Orthodox Parishioner:
                    </span>
                    <span>{cText}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenReport('comment', `comment-${post.id}-${idx}`, 'Orthodox Member', cText)
                    }
                    className="text-[#8b6b4a] hover:text-amber-700 p-1 cursor-pointer"
                    title="Report Comment"
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a spiritual reflection or comment..."
              className="flex-1 p-2.5 rounded-xl bg-[#f5f2ed] dark:bg-[#282019] border border-[#d4af37]/30 text-xs text-[#2c2c2c] dark:text-[#f5ebd9] focus:outline-none focus:border-[#d4af37]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-[#c5a059] to-[#8f6e30] hover:from-[#e6d3ab] hover:to-[#c5a059] text-[#1c130c] font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all"
            >
              Comment
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
