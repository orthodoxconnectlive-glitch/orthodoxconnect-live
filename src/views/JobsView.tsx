import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, X, MapPin, Phone, User, Trash2, Loader2, Banknote,
} from 'lucide-react';
import { jobsApi } from '../lib/api';
import { Job } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const inputCls =
  'w-full p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-ph) focus:outline-none text-sm';

export const JobsView: React.FC = () => {
  const { profile } = useAuth();
  const { language } = useTheme();
  const ar = language === 'ar';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [salary, setSalary] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'super_admin' ||
    profile?.email === 'orthodoxconnect.live@gmail.com';

  const load = async (q = '') => {
    setLoading(true);
    try {
      setJobs(await jobsApi.list(q));
    } catch (e) {
      console.warn('Jobs load notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setAddress(''); setSalary(''); setContact('');
    setFormError('');
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setFormError(ar ? 'اكتب المسمى الوظيفي' : 'Please enter the job title');
      return;
    }
    if (!address.trim()) {
      setFormError(ar ? 'اكتب عنوان / مكان العمل' : 'Please enter the job location');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const job = await jobsApi.create({
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        salary: salary.trim(),
        contact: contact.trim(),
        posted_by_name: profile?.full_name || profile?.name || '',
      });
      setJobs((prev) => [job, ...prev]);
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      setFormError(ar ? 'تعذر نشر الوظيفة. حاول مجددًا.' : 'Could not post the job. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (job: Job) => {
    // Two-tap inline confirm
    if (confirmDeleteId !== job.id) {
      setConfirmDeleteId(job.id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await jobsApi.remove(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (e: any) {
      alert(e?.message || (ar ? 'تعذر حذف الوظيفة.' : 'Could not delete the job.'));
    }
  };

  const canManage = (job: Job) =>
    isAdmin || (profile?.id && job.posted_by && profile.id === job.posted_by);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-serif font-bold text-(--tx-strong) dark:text-[#f5ebd9] flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-amber-700 dark:text-amber-300" />
          {ar ? 'الوظائف' : 'Jobs'}
        </h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 dark:bg-amber-600 text-white text-sm font-bold shadow hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          {ar ? 'انشر وظيفة' : 'Post a Job'}
        </button>
      </div>
      <p className="text-xs text-(--tx-soft) dark:text-[#c9b795] mb-3 font-serif">
        {ar
          ? 'هل تبحث عن عمل أو تريد توظيف أحد؟ انشر هنا — مجتمعنا يساعد بعضه.'
          : 'Looking for work or looking to hire? Post here — our community helps each other.'}
      </p>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--tx-ph)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ar ? 'ابحث عن وظيفة...' : 'Search jobs...'}
          className="w-full ps-9 p-2.5 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-ph) focus:outline-none text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-(--tx-ph) hover:text-(--tx-strong)"
            aria-label={ar ? 'مسح' : 'Clear'}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-700 dark:text-amber-300" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-(--tx-soft) dark:text-[#c9b795] font-serif">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{ar ? 'لا توجد وظائف بعد. كن أول من ينشر!' : 'No jobs yet. Be the first to post!'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-bold text-base text-(--tx-head) dark:text-[#f5ebd9]">
                    {job.title}
                  </h3>
                  {job.address && (
                    <p className="flex items-center gap-1 text-xs text-(--tx-soft) dark:text-[#c9b795] mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">📍 {job.address}</span>
                    </p>
                  )}
                  {job.salary && (
                    <p className="flex items-center gap-1 text-sm font-bold text-green-700 dark:text-green-400 mt-1">
                      <Banknote className="w-4 h-4 shrink-0" />
                      <span>💰 {job.salary}</span>
                    </p>
                  )}
                </div>
                {canManage(job) && (
                  <button
                    onClick={() => handleDelete(job)}
                    className={`shrink-0 p-2 rounded-xl transition-colors ${
                      confirmDeleteId === job.id
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200'
                    }`}
                    title={ar ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {confirmDeleteId === job.id && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
                  {ar ? 'اضغط مرة أخرى للتأكيد' : 'Tap again to confirm delete'}
                </p>
              )}
              {job.description && (
                <p className="text-sm text-(--tx-strong) dark:text-[#e8dcc3] mt-2 whitespace-pre-wrap">
                  {job.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-(--ln-bright)/20">
                {job.contact && (
                  <p className="flex items-center gap-1 text-xs text-(--tx-soft) dark:text-[#c9b795]">
                    <Phone className="w-3.5 h-3.5" />
                    {job.contact}
                  </p>
                )}
                {job.posted_by_name && (
                  <p className="flex items-center gap-1 text-xs text-(--tx-soft) dark:text-[#c9b795]">
                    <User className="w-3.5 h-3.5" />
                    {job.posted_by_name}
                  </p>
                )}
                {job.created_at && (
                  <p className="text-xs text-(--tx-ph) ms-auto">
                    {formatDate(job.created_at)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setIsCreateOpen(false)}>
          <div
            className="w-full sm:max-w-lg bg-(--bg-card) dark:bg-[#1c1611] rounded-t-3xl sm:rounded-3xl border-2 border-(--ln-gold) p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-bold text-lg text-(--tx-head) dark:text-[#f5ebd9] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                {ar ? 'انشر وظيفة' : 'Post a Job'}
              </h2>
              <button
                onClick={() => { setIsCreateOpen(false); resetForm(); }}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={ar ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-3">{formError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-(--tx-soft) dark:text-[#c9b795] block mb-1">
                  {ar ? 'المسمى الوظيفي *' : 'Job Title *'}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={ar ? 'مثال: سائق توصيل' : 'e.g. Delivery Driver'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--tx-soft) dark:text-[#c9b795] block mb-1">
                  {ar ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={ar ? 'تفاصيل الوظيفة، الشروط، الدوام...' : 'Job details, requirements, hours...'}
                  rows={3}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--tx-soft) dark:text-[#c9b795] block mb-1">
                  {ar ? 'العنوان / مكان العمل *' : 'Address / Location *'}
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={ar ? 'مثال: فيرفاكس، فيرجينيا' : 'e.g. Fairfax, VA'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--tx-soft) dark:text-[#c9b795] block mb-1">
                  {ar ? 'الراتب / الأجر' : 'Salary / Pay'}
                </label>
                <input
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder={ar ? 'مثال: $20/ساعة' : 'e.g. $20/hour'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--tx-soft) dark:text-[#c9b795] block mb-1">
                  {ar ? 'معلومات التواصل' : 'Contact Info'}
                </label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={ar ? 'هاتف أو بريد إلكتروني' : 'Phone or email'}
                  className={inputCls}
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={submitting}
              className="w-full mt-4 py-3 rounded-xl bg-amber-700 dark:bg-amber-600 text-white font-bold text-sm shadow hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {ar ? 'نشر الوظيفة' : 'Post Job'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsView;
