/**
 * Web Audio API Ringtone and Notification Chime Synthesizer
 * Generates crystal-clear, reliable audio alerts for notifications and calls
 * without relying on external mp3 assets that might fail to load.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private outgoingInterval: any = null;
  private isRinging = false;
  private isOutgoing = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
      return null;
    }
  }

  /**
   * Plays a pleasant 2-tone melodic chime for new likes, comments, and messages.
   */
  public playNotificationChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1: High bell chime (E6 ~ 1318.5 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.5, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2: Harmonic resolving chime (G#6 ~ 1661.2 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1661.2, now + 0.09);
      gain2.gain.setValueAtTime(0, now + 0.09);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Notification chime error:', e);
    }
  }

  /**
   * Plays a rhythmic, multi-tone Orthodox liturgical / telephone ringtone loop
   * for incoming calls that repeats until answered or declined.
   */
  public playIncomingRingtone() {
    if (this.isRinging) return;
    this.isRinging = true;

    const playSingleRingBurst = () => {
      if (!this.isRinging) return;
      try {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Dual harmonized ring burst (523Hz C5 + 659Hz E5 + 784Hz G5)
        const frequencies = [523.25, 659.25, 783.99];

        frequencies.forEach((freq, i) => {
          // Tone 1 in the burst
          const oscA = ctx.createOscillator();
          const gainA = ctx.createGain();
          oscA.type = 'sine';
          oscA.frequency.setValueAtTime(freq, now);
          gainA.gain.setValueAtTime(0, now);
          gainA.gain.linearRampToValueAtTime(0.12 / (i + 1), now + 0.04);
          gainA.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          oscA.connect(gainA);
          gainA.connect(ctx.destination);
          oscA.start(now);
          oscA.stop(now + 0.45);

          // Tone 2 in the burst (0.45s later)
          const oscB = ctx.createOscillator();
          const gainB = ctx.createGain();
          oscB.type = 'sine';
          oscB.frequency.setValueAtTime(freq * 1.25, now + 0.45);
          gainB.gain.setValueAtTime(0, now + 0.45);
          gainB.gain.linearRampToValueAtTime(0.14 / (i + 1), now + 0.49);
          gainB.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          oscB.connect(gainB);
          gainB.connect(ctx.destination);
          oscB.start(now + 0.45);
          oscB.stop(now + 1.25);
        });
      } catch (e) {
        console.warn('Ringtone burst error:', e);
      }
    };

    // Play first burst immediately
    playSingleRingBurst();

    // Repeat every 2.4 seconds
    this.ringtoneInterval = setInterval(() => {
      if (this.isRinging) {
        playSingleRingBurst();
      }
    }, 2400);

    // Trigger mobile vibration pattern if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([400, 200, 400, 200, 800]);
      } catch (e) {}
    }
  }

  /**
   * Stops incoming call ringtone.
   */
  public stopIncomingRingtone() {
    this.isRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }

  /**
   * Plays soft outgoing ringback tone for caller.
   */
  public playOutgoingRing() {
    if (this.isOutgoing) return;
    this.isOutgoing = true;

    const playBeep = () => {
      if (!this.isOutgoing) return;
      try {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.3);
      } catch (e) {}
    };

    playBeep();
    this.outgoingInterval = setInterval(() => {
      if (this.isOutgoing) playBeep();
    }, 3000);
  }

  /**
   * Stops outgoing ring tone.
   */
  public stopOutgoingRing() {
    this.isOutgoing = false;
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }
}

export const soundSynth = new SoundSynthesizer();

/**
 * Triggers a native Web Notification (shows on OS/screen even if tab is in background).
 */
export async function triggerBrowserNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      const notif = new Notification(title, {
        icon: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
        badge: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=96',
        ...options,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const notif = new Notification(title, {
          icon: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=192',
          ...options,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
        return true;
      }
    }
  } catch (e) {
    console.warn('Browser notification trigger failed:', e);
  }

  return false;
}
