import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Download, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  file_size_mb?: number;
}

export const LibraryView: React.FC = () => {
  const { language } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'patristics', ar: 'آبائيات', en: 'Patristics' },
    { id: 'dogma', ar: 'عقيدة ولاهوت', en: 'Dogmatics' },
    { id: 'spiritual', ar: 'روحيات وسير قديسين', en: 'Spiritual' },
    { id: 'liturgy', ar: 'طقوس وتسبحة', en: 'Liturgy' },
    { id: 'bible_study', ar: 'دراسات كتابية', en: 'Bible Study' },
  ];

  useEffect(() => {
    // Replace with your Cloudflare Worker / D1 API route
    fetch(`/api/books?category=${selectedCategory}&q=${encodeURIComponent(search)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setBooks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading books:', err);
        setLoading(false);
      });
  }, [search, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-[#f6ebd6] dark:bg-[#1c1611] border-2 border-[#c5a059] dark:border-[#8b6b4a] rounded-3xl p-6 shadow-md text-center">
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
    </div>
  );
};
