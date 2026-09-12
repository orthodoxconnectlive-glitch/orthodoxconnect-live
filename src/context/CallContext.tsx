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
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (partner: CallPartnerInfo, type: 'audio' | 'video') => void;
  answerCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  switchCamera: () => Promise<void>;
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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

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
        // WebRTC: create the offer now that the callee picked up
        (async () => {
          const cur = activeCallRef.current;
          if (!cur) return;
          try {
            const pc = createPeerConnection(cur.id, cur.partnerId, cur.type);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSdpSignal('WEBRTC_OFFER', cur.id, cur.partnerId, cur.type, JSON.stringify(offer));
          } catch (e) {
            console.warn('[webrtc] offer failed:', e);
          }
        })();
      } else if (signal.type === 'WEBRTC_OFFER' && signal.callId === activeCallRef.current?.id && signal.sdp) {
        // Callee side: offer arrived — answer it
        (async () => {
          const cur = activeCallRef.current;
          if (!cur) return;
          try {
            const pc = createPeerConnection(cur.id, cur.partnerId, cur.type);
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.sdp!)));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSdpSignal('WEBRTC_ANSWER', cur.id, cur.partnerId, cur.type, JSON.stringify(answer));
            // Flush any ICE candidates that arrived before the remote description
            for (const init of pendingIceRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
            }
            pendingIceRef.current = [];
          } catch (e) {
            console.warn('[webrtc] answer failed:', e);
          }
        })();
      } else if (signal.type === 'WEBRTC_ANSWER' && signal.callId === activeCallRef.current?.id && signal.sdp) {
        // Caller side: answer arrived — complete the handshake
        (async () => {
          const pc = peerConnectionRef.current;
          if (!pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.sdp!)));
            for (const init of pendingIceRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
            }
            pendingIceRef.current = [];
          } catch (e) {
            console.warn('[webrtc] setRemoteDescription(answer) failed:', e);
          }
        })();
      } else if (signal.type === 'WEBRTC_ICE' && signal.callId === activeCallRef.current?.id && signal.candidate) {
        // Trickle ICE from the other side
        (async () => {
          const pc = peerConnectionRef.current;
          const init = JSON.parse(signal.candidate!) as RTCIceCandidateInit;
          if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
          } else {
            pendingIceRef.current.push(init);
          }
        })();
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

  // --- WebRTC: local media -------------------------------------------------
  const startLocalStream = async (callType: 'audio' | 'video', facing: 'user' | 'environment' = 'user') => {
    try {
      // Stop any previous tracks first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          callType === 'video'
            ? { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      facingModeRef.current = facing;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('[webrtc] getUserMedia failed:', err);
      return null;
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
    pendingIceRef.current = [];
    setRemoteStream(null);
  };

  // --- WebRTC: peer connection ----------------------------------------------
  const createPeerConnection = (callId: string, partnerId: string, callType: 'audio' | 'video') => {
    closePeerConnection();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnectionRef.current = pc;

    // Send our ICE candidates to the other side through the signal channel
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callSignaling.sendSignal({
          type: 'WEBRTC_ICE',
          callId,
          callerId: profile?.id || 'me',
          callerName: profile?.full_name || 'Parishioner',
          targetUserId: partnerId,
          callType,
          timestamp: Date.now(),
          candidate: JSON.stringify(event.candidate.toJSON()),
        });
      }
    };

    // Remote media arrived — show it
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[webrtc] connection', pc.connectionState);
      }
    };

    // Attach our local tracks
    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((track) => pc.addTrack(track, ls));
    }

    return pc;
  };

  const sendSdpSignal = (
    type: 'WEBRTC_OFFER' | 'WEBRTC_ANSWER',
    callId: string,
    partnerId: string,
    callType: 'audio' | 'video',
    sdp: string,
  ) => {
    callSignaling.sendSignal({
      type,
      callId,
      callerId: profile?.id || 'me',
      callerName: profile?.full_name || 'Parishioner',
      targetUserId: partnerId,
      callType,
      timestamp: Date.now(),
      sdp,
    });
  };

  // --- WebRTC: camera switch ---------------------------------------------------
  const switchCamera = async () => {
    const cur = activeCallRef.current;
    if (!cur || cur.type !== 'video') return;
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = stream.getVideoTracks()[0];
      if (!newVideoTrack) return;
      // Swap the track on the live peer connection (no renegotiation needed)
      const sender = peerConnectionRef.current
        ?.getSenders()
        .find((sn) => sn.track && sn.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      // Stop the old video tracks, keep audio
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      const ls = localStreamRef.current;
      if (ls) {
        ls.getVideoTracks().forEach((t) => ls.removeTrack(t));
        ls.addTrack(newVideoTrack);
        setLocalStream(ls);
      } else {
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      facingModeRef.current = nextFacing;
    } catch (err) {
      console.warn('[webrtc] switchCamera failed:', err);
    }
  };

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

    // Open our camera/mic right away so media is ready for WebRTC
    startLocalStream(type, 'user');

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

    // Open our camera/mic so we can answer with two-way media
    startLocalStream(callState.type, 'user');

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

    closePeerConnection();
    stopLocalStream();
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

    closePeerConnection();
    stopLocalStream();
    setCallState(null);
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        localStream,
        remoteStream,
        initiateCall,
        answerCall,
        declineCall,
        endCall,
        switchCamera,
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
