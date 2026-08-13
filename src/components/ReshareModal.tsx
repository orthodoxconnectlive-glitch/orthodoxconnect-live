import React, { useState } from 'react';
import { X, Repeat, Quote, Send } from 'lucide-react';
import { Post } from '../types';
import { createReshare } from '../utils/posts';

interface ReshareModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onReshareCreated: (newPost: Post) => void;
}

export const ReshareModal: React.FC<ReshareModalProps> = ({
  post,
  isOpen,
  onClose,
  onReshareCreated,
}) => {
  const [kind, setKind] = useState<'reshare' | 'quote'>('reshare');
  const [quoteText, setQuoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !post) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newPost = await createReshare(post.id, kind, kind === 'quote' ? quoteText : undefined);
    setIsSubmitting(false);
    onReshareCreated(newPost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-stone-950 border border-amber-600/40 rounded-2xl p-6 shadow-2xl text-stone-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-serif font-bold text-lg text-amber-100 mb-4 flex items-center gap-2">
          <Repeat className="w-5 h-5 text-amber-400" />
          <span>Reshare Post</span>
        </h3>

        {/* Reshare Type Toggle */}
        <div className="flex rounded-xl bg-stone-900 p-1 mb-4 border border-amber-900/30">
          <button
            type="button"
            onClick={() => setKind('reshare')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              kind === 'reshare' ? 'bg-amber-600 text-stone-950' : 'text-stone-400'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Instant Reshare</span>
          </button>
          <button
            type="button"
            onClick={() => setKind('quote')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              kind === 'quote' ? 'bg-amber-600 text-stone-950' : 'text-stone-400'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Quote Post</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {kind === 'quote' && (
            <div>
              <textarea
                rows={3}
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Add your spiritual reflection or comment..."
                className="w-full p-3 rounded-xl bg-stone-900 border border-amber-900/30 text-xs text-amber-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Quoted Post Card Preview */}
          <div className="p-3 rounded-xl bg-stone-900/80 border border-amber-900/30 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-6 h-6 rounded-full border border-amber-500/30 object-cover"
              />
              <span className="font-bold text-amber-100">{post.authorName}</span>
              <span className="text-[10px] text-stone-400">• {post.authorParish}</span>
            </div>
            <p className="text-stone-300 italic line-clamp-3 pl-8">"{post.text}"</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sharing...' : 'Confirm Reshare'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
