import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Send, Loader2, Church } from 'lucide-react';
import { API_BASE_URL, authHeader } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

type Mode = 'bible' | 'sermon' | 'lesson' | 'qa';

interface StudyMsg {
  role: 'user' | 'ai';
  text: string;
  sources?: string[];
}

const MODES: { id: Mode; en: string; ar: string }[] = [
  { id: 'bible', en: 'Bible study', ar: 'دراسة الكتاب' },
  { id: 'sermon', en: 'Sermon prep', ar: 'تحضير عظة' },
  { id: 'lesson', en: 'Lesson prep', ar: 'تحضير درس' },
  { id: 'qa', en: 'Questions', ar: 'أسئلة' },
];

export const StudyView: React.FC = () => {
  const { language } = useTheme();
  const ar = language === 'ar';
  const [mode, setMode] = useState<Mode>('bible');
  const [msgs, setMsgs] = useState<StudyMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      // Study answers take longer than a normal API call (AI generation),
      // so this request gets a 90s timeout instead of apiFetch's 25s —
      // the previous timeout made slow-but-working answers look like failures.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      let d: any;
      try {
        const res = await fetch(`${API_BASE_URL}/api/study`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ question: q, mode, language: ar ? 'ar' : 'en' }),
          signal: controller.signal,
        });
        d = await res.json();
      } finally {
        clearTimeout(timer);
      }
      if (!d?.success) throw new Error(d?.error || 'ai_failed');
      setMsgs((m) => [...m, { role: 'ai', text: d.answer || '', sources: d.sources || [] }]);
    } catch (e: any) {
      const code = String(e?.message || e || '');
      setError(
        code.includes('not_configured')
          ? (ar ? 'ركن الدراسة يحتاج مفتاح Gemini على الخادم — سيتم تفعيله قريباً.' : 'The study corner needs a Gemini key on the server — it will be enabled soon.')
          : (ar ? 'تعذر الحصول على إجابة الآن، حاول مرة أخرى.' : 'Could not get an answer right now, please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 pb-24">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-lg text-(--tx-strong) dark:text-[#f5ebd9]">
            {ar ? 'ركن الدراسة' : 'Study Corner'}
          </h2>
          <p className="text-xs text-(--tx-mute) dark:text-[#a89379]">
            {ar ? 'دراسة كتابية، تحضير عظات ودروس — بمصادر' : 'Bible study, sermon and lesson prep — with sources'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3.5 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${
              mode === m.id
                ? 'bg-(--ac-gold) text-white shadow-md'
                : 'bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9]'
            }`}
          >
            {ar ? m.ar : m.en}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-4">
        {msgs.length === 0 && (
          <div className="rounded-2xl border border-(--ln-gold) bg-(--bg-card) dark:bg-[#1c1611] p-4 text-sm text-(--tx-mute) dark:text-[#a89379] leading-relaxed">
            {ar
              ? 'اسأل مثلاً: «اشرح مثل الابن الضال مع شواهده» أو «حضّر درساً عن الصوم الكبير للشباب». كل إجابة تذكر مصادرها، وما ليس له مصدر يُقال صراحة.'
              : 'Try e.g. “Explain the parable of the prodigal son with its references” or “Prepare a lesson on Great Lent for youth.” Every answer names its sources — and what has no source is said plainly.'}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-(--ac-gold) text-white'
                  : 'bg-(--bg-card) dark:bg-[#1c1611] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9]'
              }`}
            >
              {m.text}
              {m.role === 'ai' && m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-(--ln-gold)/40 text-xs opacity-90">
                  <span className="font-bold">{ar ? 'المصادر: ' : 'Sources: '}</span>
                  {m.sources.join(ar ? ' ، ' : ' · ')}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-(--tx-mute) dark:text-[#a89379]">
            <Loader2 className="w-4 h-4 animate-spin" />
            {ar ? 'جارٍ البحث والتحضير…' : 'Searching and preparing…'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
      )}

      <div className="flex gap-2 sticky bottom-20">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={ar ? 'اكتب سؤالك هنا…' : 'Ask your question here…'}
          className="flex-1 p-3 rounded-xl bg-(--bg-card) dark:bg-[#282019] border border-(--ln-gold) text-(--tx-strong) dark:text-[#f5ebd9] placeholder-(--tx-ph) focus:outline-none text-sm"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-12 h-12 rounded-xl bg-(--ac-gold) text-white flex items-center justify-center shadow-md cursor-pointer disabled:opacity-50 shrink-0"
          aria-label={ar ? 'إرسال' : 'Send'}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-(--tx-mute) dark:text-[#a89379] mt-4 leading-relaxed">
        <Church className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        {ar
          ? 'تنبيه: الذكاء الاصطناعي قد يخطئ. راجع أي أمر عقائدي مع أب اعترافك أو كاهن كنيستك قبل التعليم به.'
          : 'Note: AI can be wrong. Check anything doctrinal with your father of confession or parish priest before teaching it.'}
      </p>
    </div>
  );
};
