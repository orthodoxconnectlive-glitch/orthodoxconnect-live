import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Download, Plus, X, Upload, Link as LinkIcon, FileText, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

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
}

export const LibraryView: React.FC = () => {
  const { language } = useTheme();
  const { profile } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Upload type toggles: 'upload' | 'url'
  const [pdfSourceType, setPdfSourceType] = useState<'upload' | 'url'>('upload');
  const [coverSourceType, setCoverSourceType] = useState<'upload' | 'url'>('url');

  // File states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title_ar: '',
    title_en: '',
    author_ar: '',
    author_en: '',
    category: 'patristics',
    cover_image_url: '',
    file_url: '',
    description: '',
  });

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.email === 'orthodoxconnect.live@gmail.com';

  const categories = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'patristics', ar: 'آبائيات', en: 'Patristics' },
    { id: 'dogma', ar: 'عقيدة ولاهوت', en: 'Dogmatics' },
    { id: 'spiritual', ar: 'روحيات وسير قديسين', en: 'Spiritual' },
    { id: 'liturgy', ar: 'طقوس وتسبحة', en: 'Liturgy' },
    { id: 'bible_study', ar: 'دراسات كتابية', en: 'Bible Study' },
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

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const data = new FormData();
    data.append('file', file);
    data.append('folder', folder);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: data,
    });

    if (!res.ok) throw new Error('Failed to upload file');
    const result = await res.json();
    return result.url;
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let finalPdfUrl = formData.file_url;
      let finalCoverUrl = formData.cover_image_url;

      // Upload PDF if selected from device
      if (pdfSourceType === 'upload') {
        if (!pdfFile) {
          alert(language === 'ar' ? 'يرجى اختيار ملف PDF' : 'Please select a PDF file');
          setSubmitting(false);
          return;
        }
        finalPdfUrl = await uploadFile(pdfFile, 'books');
      }

      // Upload Cover if selected from device
      if (coverSourceType === 'upload' && coverFile) {
        finalCoverUrl = await uploadFile(coverFile, 'covers');
      }

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `book-${Date.now()}`,
          ...formData,
          file_url: finalPdfUrl,
          cover_image_url: finalCoverUrl || null,
        }),
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({
          title_ar: '',
          title_en: '',
          author_ar: '',
          author_en: '',
          category: 'patristics',
          cover_image_url: '',
          file_url: '',
          description: '',
        });
        setPdfFile(null);
        setCoverFile(null);
        fetchBooks();
      } else {
        alert(language === 'ar' ? 'فشل حفظ الكتاب' : 'Failed to save book');
      }
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'حدث خطأ أثناء رفع وحفظ الكتاب' : 'Error uploading and saving book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-6 shadow-md text-center relative">
        {isSuperAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="absolute top-4 left-4 rtl:left-auto rtl:right-4 px-3.5 py-1.5 rounded-full bg-[#c5a059] text-white text-xs font-serif font-bold flex items-center gap-1.5 shadow-md hover:bg-[#b08b43] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة كتاب' : 'Add Book'}</span>
          </button>
        )}

        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#eedcb5] dark:bg-[#282019] border border-[#c5a059] flex items-center justify-center text-[#a8833c] mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="font-serif-coptic font-bold text-2xl text-[#3d2b18] dark:text-[#f5ebd9]">
          {language === 'ar' ? 'المكتبة القبطية والمسيحية' : 'Coptic Christian Library'}
        </h1>
        <p className="text-xs text-[#7c5f3d] dark:text-[#a89379] font-serif uppercase tracking-wider mt-1">
          {language === 'ar' ? 'كتب، مراجع، ودراسات آبائية وكتابية' : 'Books, patristics & theological references'}
        </p>
      </div>

      {/* Search & Categories Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[#7c5f3d] dark:text-[#a89379]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'ar' ? 'بحث عن اسم كتاب أو مؤلف...' : 'Search title or author...'}
            className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 text-xs font-serif rounded-full bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059] dark:border-[#8b6b4a] text-[#3d2b18] dark:text-[#f5ebd9] placeholder-[#7c5f3d]/60 focus:outline-none focus:border-[#a8833c]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-serif font-bold transition-all cursor-pointer border ${
                selectedCategory === cat.id
                  ? 'bg-[#c5a059] text-white border-[#c5a059] shadow-sm'
                  : 'bg-[#f6ebd6] dark:bg-[#1c1611] text-[#3d2b18] dark:text-[#f5ebd9] border-[#c5a059]/40 hover:border-[#a8833c]'
              }`}
            >
              {language === 'ar' ? cat.ar : cat.en}
            </button>
          ))}
        </div>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#7c5f3d] dark:text-[#a89379] font-serif text-sm animate-pulse">
          {language === 'ar' ? 'جاري تحميل الكتب...' : 'Loading books...'}
        </div>
      ) : books.length === 0 ? (
        <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border border-[#c5a059]/40 rounded-3xl p-12 text-center text-[#7c5f3d] dark:text-[#a89379] font-serif text-sm">
          {language === 'ar' ? 'لا توجد كتب متاحة حالياً.' : 'No books found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div className="h-44 bg-[#eedcb5] dark:bg-[#282019] flex items-center justify-center overflow-hidden border-b border-[#c5a059]/30">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title_ar} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-12 h-12 text-[#c5a059]" />
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif-coptic font-bold text-sm text-[#3d2b18] dark:text-[#f5ebd9] line-clamp-2">
                    {language === 'ar' ? book.title_ar : book.title_en || book.title_ar}
                  </h3>
                  <p className="text-[11px] text-[#7c5f3d] dark:text-[#a89379] font-serif mt-1">
                    {language === 'ar' ? book.author_ar : book.author_en || book.author_ar}
                  </p>
                </div>

                <a
                  href={book.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-[#c5a059] text-white text-xs font-serif font-bold flex items-center justify-center gap-1.5 hover:bg-[#b08b43] transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'قراءة / تحميل' : 'Read / Download'}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Add Book Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#eedcb5] dark:bg-[#18120e] border-2 border-[#c5a059] dark:border-[#8b6b4a] w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-[#3d2b18] dark:text-[#f5ebd9] my-8">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 left-4 rtl:left-auto rtl:right-4 text-[#7c5f3d] hover:text-[#3d2b18] dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif-coptic font-bold text-lg mb-4 text-center">
              {language === 'ar' ? 'إضافة كتاب جديد للمكتبة' : 'Add New Book'}
            </h2>

            <form onSubmit={handleAddBook} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم الكتاب (عربي) *' : 'Title (Arabic) *'}</label>
                <input
                  required
                  type="text"
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="مثال: تجسد الكلمة"
                  className="w-full p-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
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
                  className="w-full p-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
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
                    className="w-full p-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المؤلف (إنجليزي)' : 'Author (English)'}</label>
                  <input
                    type="text"
                    value={formData.author_en}
                    onChange={(e) => setFormData({ ...formData, author_en: e.target.value })}
                    placeholder="St. Athanasius"
                    className="w-full p-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'القسم *' : 'Category *'}</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
                >
                  <option value="patristics">آبائيات (Patristics)</option>
                  <option value="dogma">عقيدة ولاهوت (Dogmatics)</option>
                  <option value="spiritual">روحيات وسير قديسين (Spiritual)</option>
                  <option value="liturgy">طقوس وتسبحة (Liturgy)</option>
                  <option value="bible_study">دراسات كتابية (Bible Study)</option>
                </select>
              </div>

              {/* PDF Selection (Upload or URL) */}
              <div className="p-3 rounded-2xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059]/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#a8833c]" />
                    <span>{language === 'ar' ? 'ملف الـ PDF *' : 'PDF File *'}</span>
                  </label>
                  <div className="flex bg-[#eedcb5] dark:bg-[#18120e] p-0.5 rounded-lg border border-[#c5a059]/40">
                    <button
                      type="button"
                      onClick={() => setPdfSourceType('upload')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        pdfSourceType === 'upload' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d]'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رفع ملف' : 'Upload'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfSourceType('url')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        pdfSourceType === 'url' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d]'
                      }`}
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رابط مباشر' : 'Link'}</span>
                    </button>
                  </div>
                </div>

                {pdfSourceType === 'upload' ? (
                  <input
                    required={pdfSourceType === 'upload'}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#c5a059] file:text-white hover:file:bg-[#b08b43] file:cursor-pointer"
                  />
                ) : (
                  <input
                    required={pdfSourceType === 'url'}
                    type="url"
                    placeholder="https://.../book.pdf"
                    value={formData.file_url}
                    onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                    className="w-full p-2 rounded-xl bg-[#eedcb5] dark:bg-[#18120e] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
                  />
                )}
              </div>

              {/* Cover Image Selection (Upload or URL) */}
              <div className="p-3 rounded-2xl bg-[#f6ebd6] dark:bg-[#282019] border border-[#c5a059]/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#a8833c]" />
                    <span>{language === 'ar' ? 'صورة الغلاف (اختياري)' : 'Cover Image (Optional)'}</span>
                  </label>
                  <div className="flex bg-[#eedcb5] dark:bg-[#18120e] p-0.5 rounded-lg border border-[#c5a059]/40">
                    <button
                      type="button"
                      onClick={() => setCoverSourceType('upload')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        coverSourceType === 'upload' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d]'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رفع صورة' : 'Upload'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverSourceType('url')}
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all ${
                        coverSourceType === 'url' ? 'bg-[#c5a059] text-white shadow-sm' : 'text-[#7c5f3d]'
                      }`}
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{language === 'ar' ? 'رابط' : 'Link'}</span>
                    </button>
                  </div>
                </div>

                {coverSourceType === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#c5a059] file:text-white hover:file:bg-[#b08b43] file:cursor-pointer"
                  />
                ) : (
                  <input
                    type="url"
                    placeholder="https://.../cover.jpg"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full p-2 rounded-xl bg-[#eedcb5] dark:bg-[#18120e] border border-[#c5a059] outline-none text-[#3d2b18] dark:text-[#f5ebd9]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#c5a059] text-white font-bold font-serif uppercase tracking-wider mt-2 shadow-md hover:bg-[#b08b43] transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (language === 'ar' ? 'جاري الرفع والحفظ...' : 'Uploading & Saving...') : (language === 'ar' ? 'حفظ الكتاب' : 'Save Book')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
