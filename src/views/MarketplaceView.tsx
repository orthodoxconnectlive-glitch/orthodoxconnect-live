import React, { useState, useEffect, useRef } from 'react';
import {
  Store, Plus, Search, X, MapPin, Phone, User, Upload, Loader2,
  ChevronLeft, ChevronRight, Tag, Trash2, Check, Pencil,
} from 'lucide-react';
import { marketplaceApi, churchesApi } from '../lib/api';
import { MarketplaceListing, Church } from '../types';
import { compressImageToDataUrl } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'books', en: 'Books', ar: 'كتب' },
  { id: 'music', en: 'Music & CDs', ar: 'موسيقى و CDs' },
  { id: 'icons', en: 'Icons & Religious', ar: 'أيقونات ومقدسات' },
  { id: 'clothing', en: 'Clothing', ar: 'ملابس' },
  { id: 'electronics', en: 'Electronics', ar: 'إلكترونيات' },
  { id: 'furniture', en: 'Furniture', ar: 'أثاث' },
  { id: 'services', en: 'Services', ar: 'خدمات' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
];

const inputCls =
  'w-full p-2.5 rounded-xl bg-[#282019] border border-(--ln-gold) text-[#f5ebd9] placeholder-(--tx-ph-dark) focus:outline-none text-sm';

const catLabel = (id: string | undefined, ar: boolean) =>
  CATEGORIES.find((c) => c.id === id)?.[ar ? 'ar' : 'en'] || (ar ? 'أخرى' : 'Other');

export const MarketplaceView: React.FC = () => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailImgIdx, setDetailImgIdx] = useState(0);

  // create form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState('books');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [churchId, setChurchId] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  const load = async (q = '', c = 'all') => {
    setLoading(true);
    try {
      setListings(await marketplaceApi.list(q, c));
    } catch (e) {
      console.warn('Marketplace load notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    churchesApi.list().then(setChurches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), category), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const resetForm = () => {
    setTitle(''); setPrice(''); setCat('books'); setDescription('');
    setAddress(''); setCity(''); setPhone(''); setChurchId('');
    setImages([]); setFormError('');
  };

  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - images.length);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const dataUrl = await compressImageToDataUrl(f, 900, 0.72);
        setImages((prev) => (prev.length < 6 ? [...prev, dataUrl] : prev));
      }
    } catch (err) {
      setFormError(ar ? 'تعذر تحميل الصور' : 'Could not process images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setFormError(ar ? 'اكتب عنوان الإعلان' : 'Please enter a title');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const church = churches.find((c) => c.id === churchId);
      const listing = await marketplaceApi.create({
        title: title.trim(),
        description: description.trim(),
        price: price.trim(),
        category: cat,
        images,
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        church_id: church?.id || '',
        church_name: church?.name || '',
        seller_id: profile?.id,
        seller_name: profile?.name,
        seller_avatar: profile?.avatar,
      });
      setListings((prev) => [listing, ...prev]);
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      setFormError(ar ? 'تعذر نشر الإعلان. حاول مجددًا.' : 'Could not publish the listing. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSold = async (listing: MarketplaceListing) => {
    try {
      const updated = await marketplaceApi.update(listing.id, { status: 'sold' });
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setSelected(null);
      void updated;
    } catch (e) {
      console.warn('Mark sold notice:', e);
    }
  };

  const handleDelete = async (listing: MarketplaceListing) => {
    if (!window.confirm(ar ? 'حذف هذا الإعلان نهائيًا؟' : 'Delete this listing permanently?')) return;
    try {
      await marketplaceApi.remove(listing.id);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setSelected(null);
    } catch (e: any) {
      alert(e?.message || (ar ? 'تعذر حذف الإعلان.' : 'Could not delete the listing.'));
    }
  };

  const canManage = (listing: MarketplaceListing) =>
    isAdmin || (profile?.id && listing.seller_id && profile.id === listing.seller_id);

  const openDetail = (listing: MarketplaceListing) => {
    setDetailImgIdx(0);
    setSelected(listing);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-700 dark:text-amber-300" />
          {ar ? 'السوق' : 'Marketplace'}
        </h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 dark:bg-amber-600 text-white text-sm font-bold shadow hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          {ar ? 'بيع' : 'Sell'}
        </button>
      </div>
      <p className="text-xs text-(--tx-soft) dark:text-[#c9b795] mb-3 font-serif">
        {ar
          ? 'الكنائس والأعضاء يعرضون هنا الكتب والأيقونات وكل ما يبيعونه — بدون دفع أونلاين، التواصل مباشرة.'
          : 'Churches and members list books, icons and anything they sell — no online payment, contact the seller directly.'}
      </p>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--tx-ph) " />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ar ? 'ابحث في السوق...' : 'Search the marketplace...'}
          className="w-full ps-9 p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-ph) focus:outline-none text-sm"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              category === c.id
                ? 'bg-amber-700 dark:bg-amber-600 text-white border-amber-700 dark:border-amber-600'
                : 'bg-(--bg-card) dark:bg-[#282019] text-(--tx-strong) dark:text-[#f5ebd9] border-(--ln-gold)'
            }`}
          >
            {ar ? c.ar : c.en}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-700 dark:text-amber-300" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-(--tx-soft) dark:text-[#c9b795] font-serif">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{ar ? 'لا توجد إعلانات بعد. كن أول من يبيع!' : 'No listings yet. Be the first to sell!'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {listings.map((l) => (
            <button
              key={l.id}
              onClick={() => openDetail(l)}
              className="text-start rounded-2xl overflow-hidden bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-black/10 dark:bg-black/40 relative">
                {l.images && l.images[0] ? (
                  <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tag className="w-10 h-10 opacity-30 text-(--tx-soft)" />
                  </div>
                )}
                {l.images && l.images.length > 1 && (
                  <span className="absolute bottom-1.5 end-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-md">
                    {l.images.length} 📷
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="font-bold text-sm text-(--tx-strong) dark:text-[#f5ebd9]">
                  {l.price || (ar ? 'السعر عند التواصل' : 'Ask for price')}
                </p>
                <p className="text-xs text-(--tx-soft) dark:text-[#c9b795] truncate mt-0.5">{l.title}</p>
                {(l.city || l.church_name) && (
                  <p className="text-[11px] text-(--tx-ph) truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[l.city, l.church_name].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-(--bg-card) dark:bg-[#1f1812] border border-(--ln-gold)"
            onClick={(e) => e.stopPropagation()}
          >
            {/* photos */}
            <div className="relative aspect-[4/3] bg-black">
              {selected.images && selected.images.length > 0 ? (
                <img src={selected.images[detailImgIdx]} alt={selected.title} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tag className="w-14 h-14 text-white/30" />
                </div>
              )}
              {selected.images && selected.images.length > 1 && (
                <>
                  <button
                    onClick={() => setDetailImgIdx((i) => (i - 1 + selected.images!.length) % selected.images!.length)}
                    className="absolute start-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white"
                  >
                    <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                  </button>
                  <button
                    onClick={() => setDetailImgIdx((i) => (i + 1) % selected.images!.length)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white"
                  >
                    <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                  </button>
                  <span className="absolute bottom-2 end-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-md">
                    {detailImgIdx + 1} / {selected.images.length}
                  </span>
                </>
              )}
              <button onClick={() => setSelected(null)} className="absolute top-2 end-2 p-2 rounded-full bg-black/50 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9]">{selected.title}</h2>
                <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold">
                  {catLabel(selected.category, ar)}
                </span>
              </div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {selected.price || (ar ? 'السعر عند التواصل' : 'Ask for price')}
              </p>
              {selected.description && (
                <p className="text-sm text-(--tx-strong) dark:text-[#f5ebd9] mt-3 whitespace-pre-wrap font-serif leading-relaxed">
                  {selected.description}
                </p>
              )}

              <div className="mt-4 space-y-2 text-sm">
                {(selected.address || selected.city) && (
                  <p className="flex items-center gap-2 text-(--tx-soft) dark:text-[#c9b795]">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {[selected.address, selected.city].filter(Boolean).join(', ')}
                  </p>
                )}
                {selected.church_name && (
                  <p className="flex items-center gap-2 text-(--tx-soft) dark:text-[#c9b795]">
                    <User className="w-4 h-4 shrink-0" />
                    {selected.church_name}
                  </p>
                )}
                <p className="flex items-center gap-2 text-(--tx-soft) dark:text-[#c9b795]">
                  {selected.seller_avatar ? (
                    <img src={selected.seller_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 shrink-0" />
                  )}
                  {ar ? 'البائع: ' : 'Seller: '}{selected.seller_name || (ar ? 'عضو' : 'Member')}
                </p>
              </div>

              {selected.phone && (
                <a
                  href={`tel:${selected.phone}`}
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-700 text-white font-bold text-sm hover:opacity-90"
                >
                  <Phone className="w-4 h-4" />
                  {ar ? 'اتصل بالبائع: ' : 'Call seller: '}{selected.phone}
                </a>
              )}

              {canManage(selected) && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleMarkSold(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-(--ln-gold) text-sm font-bold text-(--tx-strong) dark:text-[#f5ebd9]"
                  >
                    <Check className="w-4 h-4" />
                    {ar ? 'تم البيع' : 'Mark as sold'}
                  </button>
                  <button
                    onClick={() => handleDelete(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-700/10 border border-red-700/40 text-sm font-bold text-red-700 dark:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                    {ar ? 'حذف' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setIsCreateOpen(false)}>
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-(--bg-card) dark:bg-[#1f1812] border border-(--ln-gold) p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9]">
                {ar ? 'اعرض شيئًا للبيع' : 'Sell something'}
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                <X className="w-5 h-5 text-(--tx-strong) dark:text-[#f5ebd9]" />
              </button>
            </div>

            {/* photos */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
            <div className="flex gap-2 flex-wrap mb-3">
              {images.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-(--ln-gold)">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 end-0.5 p-0.5 rounded-full bg-black/60 text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-(--ln-gold) flex flex-col items-center justify-center text-(--tx-soft) dark:text-[#c9b795]"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  <span className="text-[10px] mt-0.5">{ar ? 'صور' : 'Photos'}</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ar ? 'العنوان * (مثال: كتاب تفسير إنجيل متى)' : 'Title * (e.g. Gospel of Matthew commentary)'} className={inputCls} />
              <div className="flex gap-2">
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={ar ? 'السعر (مثال: $20)' : 'Price (e.g. $20)'} className={inputCls} />
                <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} shrink-0`} style={{ width: '42%' }}>
                  {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>
                  ))}
                </select>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={ar ? 'الوصف...' : 'Description...'} className={inputCls} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ar ? 'العنوان' : 'Address'} className={inputCls} />
              <div className="flex gap-2">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={ar ? 'المدينة' : 'City'} className={inputCls} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={ar ? 'رقم الهاتف' : 'Phone number'} className={inputCls} />
              </div>
              {churches.length > 0 && (
                <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'بيع كعضو (بدون كنيسة)' : 'Sell as member (no church)'}</option>
                  {churches.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {formError && <p className="text-xs text-red-600 dark:text-red-300 font-bold">{formError}</p>}
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-amber-700 dark:bg-amber-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {ar ? 'انشر الإعلان' : 'Publish listing'}
              </button>
              <p className="text-[11px] text-center text-(--tx-ph)">
                {ar ? 'بدون دفع أونلاين — المشتري يتواصل معك مباشرة.' : 'No online payment — buyers contact you directly.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
