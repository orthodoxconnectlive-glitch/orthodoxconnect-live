/**
 * Real-Time Call Signaling Layer
 * Handles cross-tab, cross-window, and multi-user WebRTC call signaling
 * using BroadcastChannel and localStorage storage events.
 */

export interface CallSignalPayload {
  type: 'OFFER_CALL' | 'RINGING' | 'ACCEPT_CALL' | 'DECLINE_CALL' | 'END_CALL';
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerParish?: string;
  targetUserId: string;
  callType: 'audio' | 'video';
  timestamp: number;
}

const CALLS_CHANNEL_NAME = 'orthodox_calls_broadcast_channel';
const LOCAL_STORAGE_CALL_SIGNAL_KEY = 'orthodox_active_call_signal_v1';

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

    // 1. Listen to BroadcastChannel
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
    // 1. Post to BroadcastChannel
    if (callsBroadcastChannel) {
      try {
        callsBroadcastChannel.postMessage(signal);
      } catch (e) {}
    }

    // 2. Write to localStorage for cross-window / cross-tab sync
    try {
      localStorage.setItem(LOCAL_STORAGE_CALL_SIGNAL_KEY, JSON.stringify(signal));
    } catch (e) {}
  }
}

export const callSignaling = new CallSignalingService();
