import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared text-to-speech hook for the Coptic Library.
 * Uses the phone's own voice (Web Speech API) — free, no network, no cost —
 * in Arabic and English.
 *
 * Long texts are split into sentence chunks: some platforms (notably iOS)
 * silently stop long utterances, so chunking keeps the reading going.
 */

export interface SpeechItem {
  text: string;
  /** spoken language — picked per item so mixed text sounds right */
  lang: 'ar' | 'en';
  /** optional id the caller can use to highlight what's being read */
  ref?: number;
}

interface UseSpeechResult {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  /** index into the items array currently being spoken (-1 when idle) */
  currentIndex: number;
  speak: (items: SpeechItem[]) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

/** Rough language guess: mostly-Arabic text reads with an Arabic voice. */
export function detectSpeechLang(text: string): 'ar' | 'en' {
  const t = text.trim();
  if (!t) return 'en';
  const arabicChars = (t.match(/[؀-ۿ]/g) || []).length;
  return arabicChars > t.length * 0.3 ? 'ar' : 'en';
}

const SENTENCE_RE = /[^.!?؟،؛\n]+[.!?؟،؛]?/g;
const MAX_CHUNK = 220;

function chunkText(text: string): string[] {
  const parts = text.match(SENTENCE_RE) || [text];
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (t.length <= MAX_CHUNK) {
      out.push(t);
      continue;
    }
    // Hard-split an overlong sentence on word boundaries.
    let cur = '';
    for (const w of t.split(/\s+/)) {
      if (cur && (cur + ' ' + w).length > MAX_CHUNK) {
        out.push(cur.trim());
        cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.length ? out : [text];
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: 'ar' | 'en',
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const prefix = lang === 'ar' ? 'ar' : 'en';
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!pool.length) return undefined;
  const exact = pool.find(
    (v) => v.lang.toLowerCase() === (lang === 'ar' ? 'ar-eg' : 'en-us'),
  );
  if (exact) return exact;
  // On-device voices keep working with no network (matters on phones).
  return pool.find((v) => v.localService) || pool[0];
}

export function useSpeech(): UseSpeechResult {
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // Generation counter: every speak()/stop() bumps it, so async utterance
  // callbacks from a cancelled queue (e.g. 'interrupted' errors) are ignored.
  const genRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices();
      } catch {
        /* noop */
      }
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      genRef.current++;
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    genRef.current++;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setSpeaking(false);
    setPaused(false);
    setCurrentIndex(-1);
  }, [supported ]);

  const pause = useCallback(() => {
    if (!supported) return;
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setPaused(true);
      }
    } catch {
      /* noop */
    }
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPaused(false);
      }
    } catch {
      /* noop */
    }
  }, [supported]);

  const speak = useCallback(
    (items: SpeechItem[]) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      const gen = ++genRef.current;
      try {
        synth.cancel();
      } catch {
        /* noop */
      }
      const clean = items
        .map((i) => ({ text: i.text.trim(), lang: i.lang, ref: i.ref }))
        .filter((i) => i.text.length > 0);
      if (!clean.length) return;

      const voices = voicesRef.current.length
        ? voicesRef.current
        : synth.getVoices();
      voicesRef.current = voices;

      const queue: { text: string; lang: 'ar' | 'en'; itemIndex: number }[] = [];
      clean.forEach((item, itemIndex) => {
        for (const c of chunkText(item.text)) {
          queue.push({ text: c, lang: item.lang, itemIndex });
        }
      });
      if (!queue.length) return;

      setSpeaking(true);
      setPaused(false);
      setCurrentIndex(-1);

      const alive = () => genRef.current === gen;
      const finish = () => {
        if (!alive()) return;
        setSpeaking(false);
        setPaused(false);
        setCurrentIndex(-1);
      };

      queue.forEach((q, qi) => {
        const u = new SpeechSynthesisUtterance(q.text);
        u.lang = q.lang === 'ar' ? 'ar-EG' : 'en-US';
        const voice = pickVoice(voices, q.lang);
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onstart = () => {
          if (alive()) setCurrentIndex(q.itemIndex);
        };
        if (qi === queue.length - 1) {
          u.onend = finish;
        }
        u.onerror = () => {
          // Errors like 'interrupted'/'canceled' fire when a queue is
          // replaced — the generation check keeps those from sticking state.
          if (qi === queue.length - 1) finish();
        };
        try {
          synth.speak(u);
        } catch {
          /* a broken utterance shouldn't kill the queue */
        }
      });
    },
    [supported],
  );

  return { supported, speaking, paused, currentIndex, speak, stop, pause, resume };
}
