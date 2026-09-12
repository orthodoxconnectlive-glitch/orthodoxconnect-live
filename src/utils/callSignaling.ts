/**
 * Real-Time Call Signaling Layer
 * Handles same-device signaling via BroadcastChannel + localStorage,
 * and cross-device signaling via the server (/api/call-signals).
 * The server also sends Web Push for incoming calls, so the callee is
 * reached even when the app is closed.
 */

export interface CallSignalPayload {
  type: 'OFFER_CALL' | 'RINGING' | 'ACCEPT_CALL' | 'DECLINE_CALL' | 'END_CALL' | 'WEBRTC_OFFER' | 'WEBRTC_ANSWER' | 'WEBRTC_ICE';
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerParish?: string;
  targetUserId: string;
  callType: 'audio' | 'video';
  timestamp: number;
  sdp?: string;
  candidate?: string;
}

const CALLS_CHANNEL_NAME = 'orthodox_calls_broadcast_channel';
const LOCAL_STORAGE_CALL_SIGNAL_KEY = 'orthodox_active_call_signal_v1';
const SERVER_POLL_INTERVAL_MS = 2500;

let callsBroadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    callsBroadcastChannel = new BroadcastChannel(CALLS_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel initialization fallback for calls:', e);
}

export class CallSignalingService {
  private listeners: ((signal: CallSignalPayload) => void)[] = [];

  constructor() {
    if (typeof window === 'undefined') return;

    // 1. Listen to BroadcastChannel (same device, instant)
    if (callsBroadcastChannel) {
      callsBroadcastChannel.onmessage = (event) => {
        if (event.data && event.data.callId) {
          this.emitSignal(event.data);
        }
      };
    }

    // 2. Listen to storage events (cross-tab fallback)
    window.addEventListener('storage', (e) => {
      if (e.key === LOCAL_STORAGE_CALL_SIGNAL_KEY && e.newValue) {
        try {
          const signal = JSON.parse(e.newValue);
          this.emitSignal(signal);
        } catch (err) {}
      }
    });
  }

  private emitSignal(signal: CallSignalPayload) {
    this.listeners.forEach((listener) => {
      try {
        listener(signal);
      } catch (err) {
        console.warn('Call signal listener error:', err);
      }
    });
  }

  public onSignal(callback: (signal: CallSignalPayload) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public sendSignal(signal: CallSignalPayload) {
    // 1. Post to BroadcastChannel (same device, instant)
    if (callsBroadcastChannel) {
      try {
        callsBroadcastChannel.postMessage(signal);
      } catch (e) {}
    }

    // 2. Write to localStorage for cross-window / cross-tab sync
    try {
      localStorage.setItem(LOCAL_STORAGE_CALL_SIGNAL_KEY, JSON.stringify(signal));
    } catch (e) {}

    // 3. Relay through the server for cross-device delivery.
    //    The server stores the signal for the target to poll, and on
    //    OFFER_CALL it also sends a Web Push (works when app is closed).
    try {
      fetch('/api/call-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
      }).catch(() => {});
    } catch (e) {}
  }

  /**
   * Poll the server for call signals addressed to this user.
   * Returns a stop function. Each signal is consumed (deleted) after delivery.
   */
  public startServerPoll(userId: string): () => void {
    let stopped = false;
    // Look back 60s on start: catches calls placed while the app was closed.
    // (The previous 10s window missed any call if the user opened the app
    // more than 10s after it started ringing.)
    let since = Date.now() - 60000;
    const seen = new Set<string>();

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(
          `/api/call-signals?user_id=${encodeURIComponent(userId)}&since=${since}`
        );
        if (res.ok) {
          const data = await res.json();
          const signals = (data && data.signals) || [];
          for (const s of signals) {
            const sid = String(s.id || '');
            if (sid && seen.has(sid)) continue;
            if (sid) seen.add(sid);
            const ts = typeof s.created_at === 'number' ? s.created_at : Date.now();
            if (ts > since) since = ts;
            this.emitSignal({
              type: s.sig_type,
              callId: s.call_id,
              callerId: s.caller_id,
              callerName: s.caller_name,
              callerAvatar: s.caller_avatar,
              targetUserId: s.target_user_id,
              callType: s.call_type,
              timestamp: ts,
              sdp: s.sdp || undefined,
              candidate: s.candidate || undefined,
            } as CallSignalPayload);
            // Consume so it is not delivered twice
            if (sid) {
              fetch(`/api/call-signals/${encodeURIComponent(sid)}`, {
                method: 'DELETE',
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        // network hiccup — try again on next tick
      }
      if (!stopped) {
        setTimeout(poll, SERVER_POLL_INTERVAL_MS);
      }
    };

    setTimeout(poll, 1200);
    return () => {
      stopped = true;
    };
  }
}

export const callSignaling = new CallSignalingService();
