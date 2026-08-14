import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallState } from '../types';
import { useAuth } from './AuthContext';
import { soundSynth, triggerBrowserNotification } from '../utils/ringtone';
import { callSignaling, CallSignalPayload } from '../utils/callSignaling';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { WebRTCCallModal } from '../components/WebRTCCallModal';
import { addNotification } from '../utils/notifications';

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

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [callState, setCallState] = useState<CallState | null>(null);
  const activeCallRef = useRef<CallState | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeCallRef.current = callState;
  }, [callState]);

  // Listen to incoming call signals
  useEffect(() => {
    const unsubscribe = callSignaling.onSignal((signal: CallSignalPayload) => {
      const myId = profile?.id || 'all';

      // Check if this signal is directed to me or broadcast to parish
      const isTargetedToMe =
        signal.targetUserId === myId ||
        signal.targetUserId === 'all' ||
        (profile?.full_name && signal.targetUserId === profile.full_name);

      // Do not ring for our own outgoing offer
      const isFromMyself = signal.callerId === myId;

      if (signal.type === 'OFFER_CALL' && isTargetedToMe && !isFromMyself) {
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

        // 3. Add to notification list
        addNotification({
          userId: myId,
          type: 'message',
          title: `Incoming ${signal.callType === 'video' ? 'Video' : 'Voice'} Call`,
          body: `${signal.callerName} is calling you.`,
          senderName: signal.callerName,
          senderAvatar: signal.callerAvatar,
          link: 'messages',
        });
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

    // Broadcast OFFER_CALL signal
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

    // Auto-connect fallback for local testing after 3.5 seconds if simulated
    setTimeout(() => {
      if (activeCallRef.current && activeCallRef.current.id === callId && activeCallRef.current.status === 'calling') {
        soundSynth.stopOutgoingRing();
        setCallState((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : null));
      }
    }, 4000);
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

    setCallState(null);
  };

  const endCall = () => {
    if (!callState) return;

    soundSynth.stopIncomingRingtone();
    soundSynth.stopOutgoingRing();

    // Broadcast END_CALL
    callSignaling.sendSignal({
      type: 'END_CALL',
      callId: callState.id,
      callerId: profile?.id || 'me',
      callerName: profile?.full_name || 'Parishioner',
      targetUserId: callState.partnerId,
      callType: callState.type,
      timestamp: Date.now(),
    });

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
