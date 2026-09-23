import React, { useState, useEffect, Suspense } from 'react';
import { Search, BookOpen, Download, Plus, X, Upload, Link as LinkIcon, FileText, Image as ImageIcon, Pencil, Trash2, Headphones, Play, Heart, MessageCircle, Share2, Send } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { ErrorBoundary } from '../components/ErrorBoundary';
import CopticReader from '../components/CopticReader';

const SynaxariumView = React.lazy(() => import('./SynaxariumView'));

interface Book {
  id: string;
  title_ar: string;
  title_en?: string;
  author_ar: string;
  author_en?: string;
  category: string;
  description?: string;
  cover_image_url?: string;
  file_url: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
}

interface BookComment {
  id: string;
  book_id: string;
  user_id: string;
  author_name?: string;
  author_avatar?: string;
  content: string;
  created_at: string;
}

const CLOUDINARY_CLOUD_NAME = 'z1ihehha';
const CLOUDINARY_PRESET = 'orthodox_books';

const getYouTubeEmbedUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') {
      const list = u.searchParams.get('list');
      if (list) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`;
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
  } catch { /* not a URL */ }
  return null;
};

export const LibraryView: React.FC<{ focusBookId?: string | null; onFocusBookConsumed?: () => void }> = ({ focusBookId, onFocusBookConsumed }) => {
  const { language } = useTheme();
  const authContext = useAuth() as any;
  const profile = authContext?.profile;
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [playingBook, setPlayingBook] = useState<Book | null>(null);
  const [synaxariumOpen, setSynaxariumOpen] = useState<boolean>(false);
  const [copticReaderOpen, setCopticReaderOpen] = useState<boolean>(false);
  // Bumps to force a full remount of the reader if its error boundary retries.
  const [readerAttempt, setReaderAttempt] = useState(0);
  const [commentBook, setCommentBook] = useState<Book | null>(null);
  const [bookComments, setBookComments] = useState<BookComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [highlightBookId, setHighlightBookId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Upload source toggles
  const [pdfSourceType, setPdfSourceType] = useState<'upload' | 'url'>('url');
  const [coverSourceType, setCoverSourceType] = useState<'upload' | 'url'>('url');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [bibleBooks, setBibleBooks] = useState<Book[]>([]);

  const initialFormState = {
    title_ar: '',
    title_en: '',
    author_ar: '',
    author_en: '',
    category: 'patristics',
    cover_image_url: '',
    file_url: '',
    description: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  const categories = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'bible', ar: 'الكتاب المقدس', en: 'Bible' },
    { id: 'patristics', ar: 'آبائيات', en: 'Patristics' },
    { id: 'dogmatics', ar: 'عقيدة ولاهوت', en: 'Dogmatics' },
    { id: 'spiritual', ar: 'روحيات وسير قديسين', en: 'Spiritual' },
    { id: 'liturgy', ar: 'طقوس وتسبحة', en: 'Liturgy' },
    { id: 'bible_study', ar: 'دراسات كتابية', en: 'Bible Study' },
    { id: 'audiobook', ar: 'كتب مسموعة', en: 'Audiobooks' },
  ];

  const fetchBooks = () => {
    setLoading(true);
    fetch(`/api/books?category=${selectedCategory}&q=${encodeURIComponent(search)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setBooks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading books:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBooks();
  }, [search, selectedCategory]);

  // Special featured Bible section — always shows Bible-category books
  useEffect(() => {
    fetch('/api/books?category=bible')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBibleBooks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const openAddModal = () => {
    setEditingBookId(null);
    setFormData(initialFormState);
    setPdfSourceType('url');
    setCoverSourceType('url');
    setPdfFile(null);
    setCoverFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setFormData({
      title_ar: book.title_ar || '',
      title_en: book.title_en || '',
      author_ar: book.author_ar || '',
      author_en: book.author_en || '',
      category: book.category || 'patristics',
      cover_image_url: book.cover_image_url || '',
      file_url: book.file_url || '',
      description: book.description || '',
    });
    setPdfSourceType('url');
    setCoverSourceType('url');
    setPdfFile(null);
    setCoverFile(null);
    setIsModalOpen(true);
  };

  const handleDeleteBook = async (id: string) => {
    const confirmMsg = language === 'ar' ? 'هل أنت متأكد من حذف هذا الكتاب؟' : 'Are you sure you want to delete this book?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setBooks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error deleting book');
    }
  };

  // --- Book likes / comments / share ---
  const toggleLike = async (book: Book) => {
    setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, liked_by_me: !b.liked_by_me, likes_count: Math.max(0, (b.likes_count || 0) + (b.liked_by_me ? -1 : 1)) } : b));
    try {
      const res = await apiFetch<{ success: boolean; liked: boolean; likes_count: number }>(
        `/api/books/${encodeURIComponent(book.id)}/like`, { method: 'POST' });
      if (res && res.success) {
        setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, liked_by_me: res.liked, likes_count: res.likes_count } : b));
      }
    } catch (err) {
      console.error('Like failed:', err);
      fetchBooks();
    }
  };

  const openComments = async (book: Book) => {
    setCommentBook(book);
    setBookComments([]);
    setNewComment('');
    setCommentsLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; comments: BookComment[] }>(
        `/api/books/${encodeURIComponent(book.id)}/comments`);
      setBookComments((res && res.comments) || []);
    } catch (err) {
      console.error('Error loading book comments:', err);
    }
    setCommentsLoading(false);
  };

  const submitComment = async () => {
    if (!commentBook || !newComment.trim()) return;
    const content = newComment.trim();
    setNewComment('');
    try {
      const res = await apiFetch<{ success: boolean; comment: BookComment; comments_count: number }>(
        `/api/books/${encodeURIComponent(commentBook.id)}/comments`,
        { method: 'POST', body: JSON.stringify({
            content,
            author_name: profile?.full_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner'),
            author_avatar: profile?.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png',
          }) });
      if (res && res.success && res.comment) {
        setBookComments((prev) => [...prev, res.comment]);
        setBooks((prev) => prev.map((b) => b.id === commentBook.id ? { ...b, comments_count: res.comments_count } : b));
        setCommentBook((prev) => prev ? { ...prev, comments_count: res.comments_count } : prev);
      }
    } catch (err) {
      console.error('Error posting book comment:', err);
      setNewComment(content);
    }
  };

  const deleteBookComment = async (commentId: string) => {
    if (!commentBook) return;
    try {
      const res = await apiFetch<{ success: boolean; comments_count: number }>(
        `/api/books/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
      if (res && res.success) {
        setBookComments((prev) => prev.filter((c) => c.id !== commentId));
        setBooks((prev) => prev.map((b) => b.id === commentBook.id ? { ...b, comments_count: res.comments_count } : b));
      }
    } catch (err) {
      console.error('Error deleting book comment:', err);
    }
  };

  const shareBook = async (book: Book) => {
    const url = `https://orthodoxconnect.live/book/${encodeURIComponent(book.id)}`;
    const title = language === 'ar' ? book.title_ar : book.title_en || book.title_ar;
    const author = language === 'ar' ? book.author_ar : book.author_en || book.author_ar;
    const text = `${title} — ${author} | OrthodoxConnect`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        return;
      } catch (e) { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert(language === 'ar' ? 'تم نسخ رابط الكتاب — شاركه مع أحبائك' : 'Book link copied — share it with your loved ones');
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  // Deep link: ?book=<id> focuses a book (opens the player for audiobooks).
  useEffect(() => {
    if (!focusBookId || books.length === 0) return;
    const target = books.find((b) => b.id === focusBookId);
    if (!target) { onFocusBookConsumed && onFocusBookConsumed(); return; }
    if (target.category === 'audiobook') {
      setPlayingBook(target);
    } else {
      setHighlightBookId(target.id);
      setTimeout(() => {
        try { document.getElementById(`book-card-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }, 300);
      setTimeout(() => setHighlightBookId(null), 4000);
    }
    onFocusBookConsumed && onFocusBookConsumed();
  }, [focusBookId, books]);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_PRESET);
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: data,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Upload failed');
    }
    const json = await res.json();
    return json.secure_url;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(language === 'ar' ? 'جاري المعالجة...' : 'Processing...');

    try {
      let finalPdfUrl = formData.file_url;
      let finalCoverUrl = formData.cover_image_url;

      if (coverSourceType === 'upload' && coverFile) {
        setStatusMessage(language === 'ar' ? 'جاري رفع صورة الغلاف...' : 'Uploading cover...');
        finalCoverUrl = await uploadToCloudinary(coverFile);
      }

      if (pdfSourceType === 'upload' && pdfFile) {
        setStatusMessage(language === 'ar' ? 'جاري رفع الملف...' : 'Uploading file...');
        finalPdfUrl = await uploadToCloudinary(pdfFile);
      }

      if (!finalPdfUrl) {
        alert(language === 'ar' ? 'يرجى توفير رابط أو ملف' : 'Please provide a file or link');
        setSubmitting(false);
        return;
      }

      const payload = {
        ...formData,
        file_url: finalPdfUrl,
        cover_image_url: finalCoverUrl || null,
      };

      const url = editingBookId ? `/api/books/${editingBookId}` : '/api/books';
      const method = editingBookId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchBooks();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to save');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] rounded-3xl p-6 shadow-md text-center relative">
        <button
          onClick={openAddModal}
          className="absolute top-4 left-4 rtl:left-auto rtl:right-4 px-3.5 py-1.5 rounded-full bg-(--ac-gold) text-white text-xs font-serif font-bold flex items-center gap-1.5 shadow-md hover:bg-(--ac-gold-deep) transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'ar' ? 'إضافة كتاب' : 'Add Book'}</span>
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-(--bg-soft) dark:bg-[#282019] border border-(--ln-gold) flex items-center justify-center text-(--ac-bronze-tx) mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="font-serif-coptic font-bold text-2xl text-(--tx-strong) dark:text-[#f5ebd9]">
          {language === 'ar' ? 'المكتبة القبطية والمسيحية' : 'Coptic Christian Library'}
        </h1>
        <p className="text-xs text-(--tx-mute) dark:text-[#a89379] font-serif uppercase tracking-wider mt-1">
          {language === 'ar' ? 'كتب، مراجع، ودراسات آبائية وكتابية' : 'Books, patristics & theological references'}
        </p>
      </div>

      {/* Coptic Library — bilingual liturgical library */}
      <div className="rounded-3xl overflow-hidden border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg bg-gradient-to-br from-[#3a2a18] via-[#241a10] to-[#3a2a18]">
        <div className="flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#d4a24e]/15 border border-[#d4a24e]/50 flex items-center justify-center shrink-0">
            <BookOpen className="w-10 h-10 text-[#d4a24e]" />
          </div>
          <div className="flex-1 text-center sm:text-left rtl:sm:text-right">
            <div className="text-[10px] font-serif uppercase tracking-[0.25em] text-[#d4a24e] mb-1">
              ✦ {language === 'ar' ? 'المكتبة القبطية' : 'Coptic Library'} ✦
            </div>
            <h2 className="font-serif-coptic font-bold text-xl sm:text-2xl text-[#f5ebd9] mb-1">
              {language === 'ar' ? 'مكتبة الصلوات والقراءات' : 'Prayers, Readings & Services'}
            </h2>
            <p className="text-xs text-[#c9b18c] font-serif leading-relaxed mb-4 line-clamp-2">
              {language === 'ar'
                ? 'الأجبية، الكتاب المقدس، السنكسار، التسبحة، والقداسات — بالعربية والإنجليزية معًا.'
                : 'Agpeya, Holy Bible, Synaxarium, Psalmody & Liturgies — English and Arabic together.'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start rtl:sm:justify-end">
              <button
                type="button"
                onClick={() => setCopticReaderOpen(true)}
                className="px-5 py-2.5 rounded-full bg-[#d4a24e] hover:bg-[#e5b85c] text-[#1c1410] text-sm font-serif font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                {language === 'ar' ? 'افتح القارئ' : 'Open Reader'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Special Bible spotlight */}
      {bibleBooks.length > 0 && (
        <div className="rounded-3xl overflow-hidden border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg bg-gradient-to-br from-[#2b1d12] via-[#1c1410] to-[#2b1d12]">
          <div className="flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-6">
            {bibleBooks[0].cover_image_url && (
              <img
                src={bibleBooks[0].cover_image_url}
                alt={language === 'ar' ? bibleBooks[0].title_ar : (bibleBooks[0].title_en || bibleBooks[0].title_ar)}
                className="w-28 sm:w-36 rounded-xl shadow-2xl border border-[#8b6b4a]/50 shrink-0"
              />
            )}
            <div className="flex-1 text-center sm:text-left rtl:sm:text-right">
              <div className="text-[10px] font-serif uppercase tracking-[0.25em] text-[#d4a24e] mb-1">
                ✦ {language === 'ar' ? 'الكتاب المقدس' : 'The Holy Bible'} ✦
              </div>
              <h2 className="font-serif-coptic font-bold text-xl sm:text-2xl text-[#f5ebd9] mb-1">
                {language === 'ar' ? bibleBooks[0].title_ar : (bibleBooks[0].title_en || bibleBooks[0].title_ar)}
              </h2>
              {bibleBooks[0].description && (
                <p className="text-xs text-[#c9b18c] font-serif leading-relaxed mb-4 line-clamp-3">
                  {bibleBooks[0].description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start rtl:sm:justify-end">
                <a
                  href={bibleBooks[0].file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-full bg-[#d4a24e] hover:bg-[#e5b85c] text-[#1c1410] text-sm font-serif font-bold flex items-center gap-2 shadow-md transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  {language === 'ar' ? 'اقرأ الآن' : 'Read Now'}
                </a>
                <a
                  href={bibleBooks[0].file_url}
                  download
                  className="px-5 py-2.5 rounded-full border border-[#d4a24e]/60 text-[#e8d5ae] text-sm font-serif font-bold flex items-center gap-2 hover:bg-[#d4a24e]/10 transition-all"
                >
                  <Download className="w-4 h-4" />
                  {language === 'ar' ? 'تحميل' : 'Download'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-(--tx-mute) dark:text-[#a89379]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'ar' ? 'بحث عن اسم كتاب أو مؤلف...' : 'Search title or author...'}
            className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 text-xs font-serif rounded-full bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) dark:border-[#8b6b4a] text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-mute)/60 focus:outline-none focus:border-(--ln-bronze)"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-serif font-bold transition-all cursor-pointer border ${
                selectedCategory === cat.id
                  ? 'bg-(--ac-gold) text-white border-(--ln-gold) shadow-sm'
                  : 'bg-(--bg-card) dark:bg-[#1c1611] text-(--tx-strong) dark:text-[#f5ebd9] border-(--ln-gold)/40 hover:border-(--ln-bronze)'
              }`}
            >
              {language === 'ar' ? cat.ar : cat.en}
            </button>
          ))}
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="text-center py-12 text-(--tx-mute) dark:text-[#a89379] font-serif text-sm animate-pulse">
          {language === 'ar' ? 'جاري تحميل الكتب...' : 'Loading books...'}
        </div>
      ) : books.length === 0 ? (
        <div className="bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold)/40 rounded-3xl p-12 text-center text-(--tx-mute) dark:text-[#a89379] font-serif text-sm">
          {language === 'ar' ? 'لا توجد كتب متاحة حالياً.' : 'No books found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <div
              key={book.id}
              id={`book-card-${book.id}`}
              className={`bg-(--bg-card) dark:bg-[#1c1611] border-2 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between relative group transition-all ${
                highlightBookId === book.id
                  ? 'border-amber-400 dark:border-amber-300 ring-4 ring-amber-300/50'
                  : 'border-(--ln-gold) dark:border-[#8b6b4a]'
              }`}
            >
              {/* Edit & Delete Action Buttons */}
              <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 flex items-center gap-1.5 z-10 bg-black/50 backdrop-blur-md p-1 rounded-xl">
                <button
                  onClick={() => openEditModal(book)}
                  className="p-1 text-white hover:text-amber-300 transition-colors"
                  title={language === 'ar' ? 'تعديل' : 'Edit'}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteBook(book.id)}
                  className="p-1 text-white hover:text-red-400 transition-colors"
                  title={language === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cover Image */}
              <div className="h-44 bg-(--bg-soft) dark:bg-[#282019] flex items-center justify-center overflow-hidden border-b border-(--ln-gold)/30">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title_ar} className="w-full h-full object-cover" />
                ) : book.category === 'audiobook' ? (
                  <Headphones className="w-12 h-12 text-(--ac-gold-tx)" />
                ) : (
                  <BookOpen className="w-12 h-12 text-(--ac-gold-tx)" />
                )}
              </div>

              {/* Book Details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif-coptic font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9] line-clamp-2">
                    {language === 'ar' ? book.title_ar : book.title_en || book.title_ar}
                  </h3>
                  <p className="text-[11px] text-(--tx-mute) dark:text-[#a89379] font-serif mt-1">
                    {language === 'ar' ? book.author_ar : book.author_en || book.author_ar}
                  </p>
                </div>

                {book.file_url && book.file_url.startsWith('synaxarium://') ? (
                  <button
                    type="button"
                    onClick={() => setSynaxariumOpen(true)}
                    className="mt-4 w-full py-2 px-3 rounded-xl bg-(--ac-gold) text-white text-xs font-serif font-bold flex items-center justify-center gap-1.5 hover:bg-(--ac-gold-deep) transition-colors shadow-sm cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'اقرأ الآن' : 'Read Now'}</span>
                  </button>
                ) : book.category === 'audiobook' ? (
                  <button
                    type="button"
                    onClick={() => setPlayingBook(book)}
                    className="mt-4 w-full py-2 px-3 rounded-xl bg-(--ac-gold) text-white text-xs font-serif font-bold flex items-center justify-center gap-1.5 hover:bg-(--ac-gold-deep) transition-colors shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'استمع الآن' : 'Listen Now'}</span>
                  </button>
                ) : (
                  <a
                    href={book.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 w-full py-2 px-3 rounded-xl bg-(--ac-gold) text-white text-xs font-serif font-bold flex items-center justify-center gap-1.5 hover:bg-(--ac-gold-deep) transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'قراءة / تحميل' : 'Read / Download'}</span>
                  </a>
                )}

                {/* Like / Comment / Share */}
                <div className="mt-2 pt-2 border-t border-(--ln-gold)/30 flex items-center justify-around">
                  <button
                    type="button"
                    onClick={() => toggleLike(book)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-serif transition-colors cursor-pointer ${
                      book.liked_by_me ? 'text-red-500' : 'text-(--tx-mute) dark:text-[#a89379] hover:text-red-400'
                    }`}
                    title={language === 'ar' ? 'إعجاب' : 'Like'}
                  >
                    <Heart className={`w-4 h-4 ${book.liked_by_me ? 'fill-red-500' : ''}`} />
                    <span>{book.likes_count || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComments(book)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-serif text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) transition-colors cursor-pointer"
                    title={language === 'ar' ? 'تعليق' : 'Comment'}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{book.comments_count || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shareBook(book)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-serif text-(--tx-mute) dark:text-[#a89379] hover:text-(--ac-gold-tx) transition-colors cursor-pointer"
                    title={language === 'ar' ? 'مشاركة' : 'Share'}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{language === 'ar' ? 'مشاركة' : 'Share'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audiobook Player Modal */}
      {playingBook && playingBook.category === 'audiobook' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPlayingBook(null)}>
          <div
            className="bg-(--bg-soft) dark:bg-[#18120e] border-2 border-(--ln-gold) dark:border-[#8b6b4a] w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-(--tx-strong) dark:text-[#f5ebd9]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlayingBook(null)}
              className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-(--tx-mute) hover:text-(--tx-strong) dark:hover:text-white"
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-(--ac-gold)/20 border border-(--ln-gold) flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5 text-(--ac-gold-tx)" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif-coptic font-bold text-base leading-snug">{language === 'ar' ? playingBook.title_ar : playingBook.title_en || playingBook.title_ar}</h2>
                <p className="text-xs text-(--tx-mute) dark:text-[#a89379] font-serif mt-0.5">{language === 'ar' ? playingBook.author_ar : playingBook.author_en || playingBook.author_ar}</p>
              </div>
            </div>
            {(() => {
              const yt = getYouTubeEmbedUrl(playingBook.file_url);
              if (yt) {
                return (
                  <iframe
                    title={playingBook.title_ar}
                    width="100%"
                    height="220"
                    src={yt}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-2xl overflow-hidden"
                  />
                );
              }
              if (playingBook.file_url.includes('soundcloud.com')) {
                return (
                  <iframe
                    title={playingBook.title_ar}
                    width="100%"
                    height="166"
                    scrolling="no"
                    frameBorder="no"
                    allow="autoplay"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(playingBook.file_url)}&color=%23b08d57&auto_play=true&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                    className="rounded-2xl overflow-hidden"
                  />
                );
              }
              return <audio controls autoPlay src={playingBook.file_url} className="w-full rounded-2xl" />;
            })()}
            <p className="text-[11px] text-(--tx-mute) dark:text-[#a89379] font-serif mt-3 text-center">
              {language === 'ar' ? 'المصدر: مشروع الكنوز القبطية — المكتبة الصوتية' : 'Source: Coptic Treasures Project — Audio Library'}
            </p>
          </div>
        </div>
      )}

      {/* Synaxarium Reader Overlay */}
      {synaxariumOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#f7f1e5] dark:bg-[#14100b]">
              <div className="font-serif text-sm animate-pulse text-(--tx-mute)">
                {language === 'ar' ? 'جاري فتح السنكسار...' : 'Opening Synaxarium...'}
              </div>
            </div>
          }
        >
          <SynaxariumView onClose={() => setSynaxariumOpen(false)} />
        </Suspense>
      )}

      {/* Coptic Library Overlay */}
      {copticReaderOpen && (
        <ErrorBoundary
          key={`coptic-reader-${readerAttempt}`}
          lang={language}
          onRetry={() => setReaderAttempt((a) => a + 1)}
        >
          <CopticReader onClose={() => setCopticReaderOpen(false)} />
        </ErrorBoundary>
      )}

      {/* Book Comments Modal */}
      {commentBook && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm" onClick={() => setCommentBook(null)}>
          <div
            className="bg-(--bg-soft) dark:bg-[#18120e] border-2 border-(--ln-gold) dark:border-[#8b6b4a] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl relative text-(--tx-strong) dark:text-[#f5ebd9] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCommentBook(null)}
              className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-(--tx-mute) hover:text-(--tx-strong) dark:hover:text-white"
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-serif-coptic font-bold text-base mb-1 text-center px-8 line-clamp-1">
              {language === 'ar' ? commentBook.title_ar : commentBook.title_en || commentBook.title_ar}
            </h2>
            <p className="text-[11px] text-(--tx-mute) dark:text-[#a89379] font-serif text-center mb-3">
              {language === 'ar' ? 'التعليقات' : 'Comments'} ({commentBook.comments_count || bookComments.length})
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[120px]">
              {commentsLoading ? (
                <p className="text-center text-xs text-(--tx-mute) font-serif py-8 animate-pulse">
                  {language === 'ar' ? 'جاري تحميل التعليقات...' : 'Loading comments...'}
                </p>
              ) : bookComments.length === 0 ? (
                <p className="text-center text-xs text-(--tx-mute) font-serif py-8">
                  {language === 'ar' ? 'لا توجد تعليقات بعد — كن أول من يعلق' : 'No comments yet — be the first to comment'}
                </p>
              ) : (
                bookComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold)/40 rounded-2xl p-2.5">
                    <img
                      src={c.author_avatar || 'https://orthodoxconnect.live/launchericon-512x512.png'}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-(--ln-gold) shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold font-serif">{c.author_name || (language === 'ar' ? 'عضو الرعية' : 'Orthodox Parishioner')}</p>
                      <p className="text-xs font-serif whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                    {(profile?.id === c.user_id || profile?.role === 'admin') && (
                      <button
                        onClick={() => deleteBookComment(c.id)}
                        className="text-(--tx-mute) hover:text-red-500 transition-colors shrink-0"
                        title={language === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-(--ln-gold)/30 pt-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                placeholder={language === 'ar' ? 'اكتب تعليقاً...' : 'Write a comment...'}
                className="flex-1 p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-xs text-(--tx-strong) dark:text-[#f5ebd9]"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="p-2.5 rounded-xl bg-(--ac-gold) text-white hover:bg-(--ac-gold-deep) transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={language === 'ar' ? 'إرسال' : 'Send'}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-(--bg-soft) dark:bg-[#18120e] border-2 border-(--ln-gold) dark:border-[#8b6b4a] w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-(--tx-strong) dark:text-[#f5ebd9] my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-(--tx-mute) hover:text-(--tx-strong) dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-coptic font-bold text-lg mb-4 text-center">
              {editingBookId 
                ? (language === 'ar' ? 'تعديل بيانات الكتاب' : 'Edit Book Details')
                : (language === 'ar' ? 'إضافة كتاب أو رابط للمكتبة' : 'Add Book or External Link')}
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم الكتاب (عربي) *' : 'Title (Arabic) *'}</label>
                <input
                  required
                  type="text"
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="مثال: تجسد الكلمة"
                  className="w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المؤلف (عربي) *' : 'Author (Arabic) *'}</label>
                <input
                  required
                  type="text"
                  value={formData.author_ar}
                  onChange={(e) => setFormData({ ...formData, author_ar: e.target.value })}
                  placeholder="مثال: القديس أثناسيوس الرسولي"
                  className="w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اسم الكتاب (إنجليزي)' : 'Title (English)'}</label>
                  <input
                    type="text"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    placeholder="On the Incarnation"
                    className="w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المؤلف (إنجليزي)' : 'Author (English)'}</label>
                  <input
                    type="text"
                    value={formData.author_en}
                    onChange={(e) => setFormData({ ...formData, author_en: e.target.value })}
                    placeholder="St. Athanasius"
                    className="w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'القسم *' : 'Category *'}</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                >
                  <option value="patristics">آبائيات (Patristics)</option>
                  <option value="dogmatics">عقيدة ولاهوت (Dogmatics)</option>
                  <option value="spiritual">روحيات وسير قديسين (Spiritual)</option>
                  <option value="liturgy">طقوس وتسبحة (Liturgy)</option>
                  <option value="bible_study">دراسات كتابية (Bible Study)</option>
                </select>
              </div>

              {/* File / Link */}
              <div className="p-3 rounded-2xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold)/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
                    <span>{language === 'ar' ? 'ملف أو رابط الكتاب *' : 'Book File or Link *'}</span>
                  </label>
                  <div className="flex bg-(--bg-soft) dark:bg-[#18120e] p-0.5 rounded-lg border border-(--ln-gold)/40">
                    <button
                      type="button"
                      onClick={() => setPdfSourceType('url')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        pdfSourceType === 'url' ? 'bg-(--ac-gold) text-white shadow-sm' : 'text-(--tx-mute)'
                      }`}
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رابط' : 'Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfSourceType('upload')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        pdfSourceType === 'upload' ? 'bg-(--ac-gold) text-white shadow-sm' : 'text-(--tx-mute)'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رفع ملف' : 'Upload'}</span>
                    </button>
                  </div>
                </div>

                {pdfSourceType === 'upload' ? (
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-(--ac-gold) file:text-white hover:file:bg-(--ac-gold-deep) file:cursor-pointer"
                  />
                ) : (
                  <input
                    required
                    type="url"
                    placeholder="https://.../book.pdf"
                    value={formData.file_url}
                    onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                    className="w-full p-2 rounded-xl bg-(--bg-soft) dark:bg-[#18120e] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                  />
                )}
              </div>

              {/* Cover Image */}
              <div className="p-3 rounded-2xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold)/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-(--ac-bronze-tx)" />
                    <span>{language === 'ar' ? 'صورة الغلاف (اختياري)' : 'Cover Image (Optional)'}</span>
                  </label>
                  <div className="flex bg-(--bg-soft) dark:bg-[#18120e] p-0.5 rounded-lg border border-(--ln-gold)/40">
                    <button
                      type="button"
                      onClick={() => setCoverSourceType('url')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        coverSourceType === 'url' ? 'bg-(--ac-gold) text-white shadow-sm' : 'text-(--tx-mute)'
                      }`}
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رابط' : 'Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverSourceType('upload')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        coverSourceType === 'upload' ? 'bg-(--ac-gold) text-white shadow-sm' : 'text-(--tx-mute)'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رفع صورة' : 'Upload'}</span>
                    </button>
                  </div>
                </div>

                {coverSourceType === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-(--ac-gold) file:text-white hover:file:bg-(--ac-gold-deep) file:cursor-pointer"
                  />
                ) : (
                  <input
                    type="url"
                    placeholder="https://.../cover.jpg"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full p-2 rounded-xl bg-(--bg-soft) dark:bg-[#18120e] border border-(--ln-gold) outline-none text-(--tx-strong) dark:text-[#f5ebd9]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-(--ac-gold) text-white font-bold font-serif uppercase tracking-wider mt-2 shadow-md hover:bg-(--ac-gold-deep) transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? (statusMessage || (language === 'ar' ? 'جاري الحفظ...' : 'Saving...'))
                  : editingBookId
                  ? (language === 'ar' ? 'تحديث الكتاب' : 'Update Book')
                  : (language === 'ar' ? 'حفظ الكتاب' : 'Save Book')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
