import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallState } from '../types';
import { useAuth } from './AuthContext';
import { soundSynth, triggerBrowserNotification } from '../utils/ringtone';
import { callSignaling, CallSignalPayload } from '../utils/callSignaling';
import { ensurePushSubscription } from '../utils/pushClient';
import { messagesApi } from '../lib/api';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { WebRTCCallModal } from '../components/WebRTCCallModal';

interface CallPartnerInfo {
  id: string;
  name: string;
  avatar?: string;
  parish?: string;
}

interface CallContextType {
  callState: CallState | null;
  initiateCall: (partner: CallPartnerInfo, type: 'audio' | 'video') => void;
  answerCall: () => void;
  declineCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

// How long to let a call ring before giving up (no answer).
const NO_ANSWER_TIMEOUT_MS = 30000;

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  // Write a call event (missed/ended) into the 1:1 chat so both sides see it.
  const logCallMessage = async (
    partnerId: string,
    callType: 'audio' | 'video',
    kind: 'missed' | 'ended',
    durationSec?: number,
  ) => {
    try {
      const myId = (profile?.id || '').replace(/^auth-/, '');
      const cleanPartnerId = (partnerId || '').replace(/^auth-/, '');
      if (!myId || !cleanPartnerId) return;
      const callLabel = callType === 'video' ? 'video' : 'voice';
      let content: string;
      if (kind === 'missed') {
        content = `\uD83D\uDCDE Missed ${callLabel} call`;
      } else {
        const mins = Math.floor((durationSec || 0) / 60);
        const secs = (durationSec || 0) % 60;
        const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        content = `\uD83D\uDCDE ${callLabel === 'video' ? 'Video' : 'Voice'} call ended • ${dur}`;
      }
      await messagesApi.send({
        sender_id: myId,
        receiver_id: cleanPartnerId,
        content,
      });
    } catch (e) {
      console.warn('[call] log message failed:', e);
    }
  };
  const [callState, setCallState] = useState<CallState | null>(null);
  const activeCallRef = useRef<CallState | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeCallRef.current = callState;
  }, [callState]);

  // Listen to incoming call signals (same-device + cross-device via server poll)
  useEffect(() => {
    const myId = profile?.id;
    if (!myId) return;

    // Register this device for Web Push call notifications (works even when app is closed)
    ensurePushSubscription(myId);

    // Poll the server for cross-device call signals
    const stopPoll = callSignaling.startServerPoll(myId);

    const unsubscribe = callSignaling.onSignal((signal: CallSignalPayload) => {
      const me = profile?.id || 'all';

      // Check if this signal is directed to me or broadcast to parish
      const isTargetedToMe =
        signal.targetUserId === me ||
        signal.targetUserId === 'all' ||
        (profile?.full_name && signal.targetUserId === profile.full_name);

      // Do not ring for our own outgoing offer
      const isFromMyself = signal.callerId === me;

      if (signal.type === 'OFFER_CALL' && isTargetedToMe && !isFromMyself) {
        // Ignore stale offers: the caller stops ringing after 30s
        // (no-answer timeout), so an offer older than that is a missed call.
        // The server-side "Incoming Voice Call" bell notification already
        // records it — no need to ring for a call that's already over.
        const offerAgeMs = Date.now() - (signal.timestamp || 0);
        if (offerAgeMs > NO_ANSWER_TIMEOUT_MS) {
          return;
        }

        // If we are already in an active call, ignore or send busy
        if (activeCallRef.current && activeCallRef.current.status === 'connected') {
          return;
        }

        const incoming: CallState = {
          id: signal.callId,
          partnerId: signal.callerId,
          partnerName: signal.callerName,
          partnerAvatar: signal.callerAvatar,
          type: signal.callType,
          status: 'ringing',
          isMuted: false,
          isVideoOff: false,
        };

        setCallState(incoming);

        // 1. Play repeating Orthodox chime ringtone
        soundSynth.playIncomingRingtone();

        // 2. Trigger native OS Web Notification even if app/tab is backgrounded/minimized
        triggerBrowserNotification(`📞 Incoming Call from ${signal.callerName}`, {
          body: `${signal.callerParish || 'Orthodox Parishioner'} is calling you on OrthodoxConnect. Click to answer.`,
          icon: signal.callerAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
          tag: 'incoming-call',
          requireInteraction: true,
        });

        // Note: the bell notification row for the call is inserted by the
        // server when the offer is relayed, so it also exists for missed
        // calls when the app was closed. No client-side insert here.
      } else if (signal.type === 'ACCEPT_CALL' && signal.callId === activeCallRef.current?.id) {
        // Partner accepted our outgoing call
        soundSynth.stopOutgoingRing();
        setCallState((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : null));
      } else if (
        (signal.type === 'DECLINE_CALL' || signal.type === 'END_CALL') &&
        signal.callId === activeCallRef.current?.id
      ) {
        // Call ended/declined
        soundSynth.stopIncomingRingtone();
        soundSynth.stopOutgoingRing();
        setCallState(null);
      }
    });

    return () => {
      unsubscribe();
      stopPoll();
    };
  }, [profile?.id, profile?.full_name]);

  const initiateCall = (partner: CallPartnerInfo, type: 'audio' | 'video') => {
    const callId = 'call-' + Date.now();
    const newCall: CallState = {
      id: callId,
      partnerId: partner.id,
      partnerName: partner.name,
      partnerAvatar: partner.avatar,
      type,
      status: 'calling',
      isMuted: false,
      isVideoOff: false,
    };

    setCallState(newCall);

    // Play outgoing ringback tone
    soundSynth.playOutgoingRing();

    // Broadcast OFFER_CALL signal (same-device instant + server relay for
    // cross-device + Web Push when the callee's app is closed)
    callSignaling.sendSignal({
      type: 'OFFER_CALL',
      callId,
      callerId: profile?.id || 'parishioner-' + Date.now(),
      callerName: profile?.full_name || 'Orthodox Parishioner',
      callerAvatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      callerParish: profile?.parish || 'Orthodox Parish',
      targetUserId: partner.id,
      callType: type,
      timestamp: Date.now(),
    });

    // No-answer timeout: if nobody picks up within 30s, end the call
    // (this also relays END_CALL so the callee stops ringing).
    setTimeout(() => {
      if (activeCallRef.current && activeCallRef.current.id === callId && activeCallRef.current.status === 'calling') {
        endCall();
      }
    }, NO_ANSWER_TIMEOUT_MS);
  };

  const answerCall = () => {
    if (!callState) return;

    soundSynth.stopIncomingRingtone();

    // Broadcast ACCEPT_CALL
    callSignaling.sendSignal({
      type: 'ACCEPT_CALL',
      callId: callState.id,
      callerId: profile?.id || 'me',
      callerName: profile?.full_name || 'Parishioner',
      targetUserId: callState.partnerId,
      callType: callState.type,
      timestamp: Date.now(),
    });

    setCallState((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : null));
  };

  const declineCall = () => {
    if (!callState) return;

    soundSynth.stopIncomingRingtone();

    // Broadcast DECLINE_CALL
    callSignaling.sendSignal({
      type: 'DECLINE_CALL',
      callId: callState.id,
      callerId: profile?.id || 'me',
      callerName: profile?.full_name || 'Parishioner',
      targetUserId: callState.partnerId,
      callType: callState.type,
      timestamp: Date.now(),
    });

    // Log it in the chat so the caller sees the missed call
    logCallMessage(callState.partnerId, callState.type, 'missed');

    setCallState(null);
  };

  const endCall = () => {
    // Use the ref (not the state closure) so this also works from timers
    // created in an earlier render (e.g. the no-answer timeout).
    const cur = activeCallRef.current;
    if (!cur) return;

    soundSynth.stopIncomingRingtone();
    soundSynth.stopOutgoingRing();

    // Broadcast END_CALL
    callSignaling.sendSignal({
      type: 'END_CALL',
      callId: cur.id,
      callerId: profile?.id || 'me',
      callerName: profile?.full_name || 'Parishioner',
      targetUserId: cur.partnerId,
      callType: cur.type,
      timestamp: Date.now(),
    });

    // Log in the chat: missed if never connected, otherwise ended w/ duration
    if (cur.status === 'connected' && cur.startedAt) {
      const secs = Math.max(1, Math.round((Date.now() - cur.startedAt) / 1000));
      logCallMessage(cur.partnerId, cur.type, 'ended', secs);
    } else {
      logCallMessage(cur.partnerId, cur.type, 'missed');
    }

    setCallState(null);
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        initiateCall,
        answerCall,
        declineCall,
        endCall,
      }}
    >
      {children}

      {/* 1. Global Incoming Ringing Call Modal */}
      {callState && callState.status === 'ringing' && (
        <IncomingCallModal
          callState={callState}
          onAccept={answerCall}
          onDecline={declineCall}
        />
      )}

      {/* 2. Global Active WebRTC Connected / Outgoing Call Modal */}
      {callState && (callState.status === 'calling' || callState.status === 'connected') && (
        <WebRTCCallModal
          callState={callState}
          onEndCall={endCall}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
