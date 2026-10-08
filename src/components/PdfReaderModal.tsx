import React from 'react';
import { X } from 'lucide-react';

interface Book {
  id: string;
  title_ar?: string;
  title_en?: string;
  file_url: string;
}

const getReadableFileUrl = (url: string): string => {
  const m = /drive\.google\.com\/uc\?export=download&id=([a-zA-Z0-9_-]+)/.exec(url || '');
  if (m) {
    // Google Docs viewer renders the PDF directly in the iframe,
    // avoiding Drive's interstitial "Open" page that escapes the modal.
    const direct = `https://drive.google.com/uc?export=download&id=${m[1]}`;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(direct)}&embedded=true`;
  }
  return url;
};

export default function PdfReaderModal({
  book,
  language,
  onClose,
}: {
  book: Book;
  language: string;
  onClose: () => void;
}) {
  const ar = language === 'ar';
  const title = ar ? book.title_ar : book.title_en || book.title_ar;

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col animate-fade-in">
      {/* Header with big X */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1512] border-b border-[#8b6b4a]/40 shrink-0">
        <h2 className="flex-1 min-w-0 text-white font-serif font-bold text-base truncate">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          aria-label={ar ? 'إغلاق الكتاب' : 'Close book'}
        >
          <X className="w-7 h-7 text-white" strokeWidth={2.5} />
        </button>
      </div>
      {/* PDF */}
      <iframe
        src={getReadableFileUrl(book.file_url)}
        className="flex-1 w-full bg-white"
        title={title || 'book'}
        allow="fullscreen"
      />
    </div>
  );
}
