import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { callSignaling, CallSignalPayload } from '../utils/callSignaling';
import { groupCallsApi } from '../lib/api';

export interface GroupParticipant {
  userId: string;
  name: string;
  avatar?: string;
  stream: MediaStream | null;
  isMe: boolean;
}

interface GroupCallInfo {
  callId: string;
  roomId: string;
  roomName: string;
}

interface GroupCallContextType {
  activeCall: GroupCallInfo | null;
  participants: GroupParticipant[];
  localStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isRecording: boolean;
  recordingSecs: number;
  joinCall: (callId: string, roomId: string, roomName: string, isHost?: boolean) => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  registerVideoEl: (key: string, el: HTMLVideoElement | null) => void;
}

const GroupCallContext = createContext<GroupCallContextType | undefined>(undefined);

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
// Mesh stays healthy up to ~6 video peers; beyond that we still allow joining
// but warn (audio-only fallback could be added later).
const MAX_PEERS = 8;

export const GroupCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [activeCall, setActiveCall] = useState<GroupCallInfo | null>(null);
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);

  const callRef = useRef<GroupCallInfo | null>(null);
  const myIdRef = useRef<string>('');
  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; name: string; avatar?: string; pendingIce: RTCIceCandidateInit[] }>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const pollStopRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<any>(null);
  const hostHeartbeatRef = useRef<any>(null);
  const isHostRef = useRef(false);

  // Recording refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const myId = (profile?.id || '').replace(/^auth-/, '');
  myIdRef.current = myId;
  const myName = profile?.full_name || 'Parishioner';
  const myAvatar = profile?.avatar_url;

  // ---- signaling helpers ----------------------------------------------------
  const signalTarget = (callId: string) => `groupcall:${callId}`;

  const sendGroupSignal = (
    type: CallSignalPayload['type'],
    callId: string,
    extra: { sdp?: string; candidate?: string; meta?: any } = {},
  ) => {
    callSignaling.sendSignal({
      type,
      callId,
      callerId: myIdRef.current || 'me',
      callerName: myName,
      callerAvatar: myAvatar,
      targetUserId: signalTarget(callId),
      callType: 'video',
      timestamp: Date.now(),
      sdp: extra.sdp,
      candidate: extra.candidate,
      meta: extra.meta ? JSON.stringify(extra.meta) : undefined,
    });
  };

  const parseMeta = (m?: string): any => {
    if (!m) return {};
    try { return JSON.parse(m); } catch { return {}; }
  };

  // ---- peer connection per participant --------------------------------------
  const createPeer = useCallback((peerId: string, peerName: string, peerAvatar?: string) => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing.pc;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry = { pc, name: peerName, avatar: peerAvatar, pendingIce: [] as RTCIceCandidateInit[] };
    peersRef.current.set(peerId, entry);

    pc.onicecandidate = (e) => {
      const call = callRef.current;
      if (e.candidate && call) {
        sendGroupSignal('GROUP_ICE', call.callId, {
          candidate: JSON.stringify(e.candidate.toJSON()),
          meta: { to: peerId },
        });
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (stream) {
        setParticipants((prev) =>
          prev.map((p) => (p.userId === peerId ? { ...p, stream } : p)),
        );
      }
    };

    // Add our local tracks
    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((t) => pc.addTrack(t, ls));
    }

    // Make sure the participant row exists
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === peerId)) return prev;
      return [...prev, { userId: peerId, name: peerName, avatar: peerAvatar, stream: null, isMe: false }];
    });

    return pc;
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const entry = peersRef.current.get(peerId);
    if (entry) {
      try { entry.pc.close(); } catch (e) {}
      peersRef.current.delete(peerId);
    }
    setParticipants((prev) => prev.filter((p) => p.userId !== peerId));
  }, []);

  // ---- incoming group signals -------------------------------------------------
  const handleGroupSignal = useCallback(async (signal: CallSignalPayload) => {
    const call = callRef.current;
    if (!call || signal.targetUserId !== signalTarget(call.callId)) return;
    const fromId = (signal.callerId || '').replace(/^auth-/, '');
    if (!fromId || fromId === myIdRef.current) return; // ignore our own
    const meta = parseMeta(signal.meta);
    // Pairwise messages carry meta.to — ignore ones not addressed to us
    if ((signal.type === 'GROUP_OFFER' || signal.type === 'GROUP_ANSWER' || signal.type === 'GROUP_ICE') && meta.to && meta.to !== myIdRef.current) {
      return;
    }

    if (signal.type === 'GROUP_JOIN') {
      const peerName = signal.callerName || meta.name || 'Parishioner';
      // Glare avoidance: the peer with the greater user ID initiates the offer
      if (myIdRef.current > fromId) {
        try {
          const pc = createPeer(fromId, peerName, signal.callerAvatar || meta.avatar);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendGroupSignal('GROUP_OFFER', call.callId, { sdp: JSON.stringify(offer), meta: { to: fromId } });
        } catch (e) {
          console.warn('[groupcall] offer failed:', e);
        }
      } else {
        // Ensure the row exists; the offer will arrive shortly
        createPeer(fromId, peerName, signal.callerAvatar || meta.avatar);
      }
    } else if (signal.type === 'GROUP_OFFER' && signal.sdp) {
      try {
        const pc = createPeer(fromId, signal.callerName || 'Parishioner', signal.callerAvatar);
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.sdp)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendGroupSignal('GROUP_ANSWER', call.callId, { sdp: JSON.stringify(answer), meta: { to: fromId } });
        const entry = peersRef.current.get(fromId);
        if (entry) {
          for (const init of entry.pendingIce) {
            try { await pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
          }
          entry.pendingIce = [];
        }
      } catch (e) {
        console.warn('[groupcall] answer failed:', e);
      }
    } else if (signal.type === 'GROUP_ANSWER' && signal.sdp) {
      const entry = peersRef.current.get(fromId);
      if (entry) {
        try {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.sdp)));
          for (const init of entry.pendingIce) {
            try { await entry.pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
          }
          entry.pendingIce = [];
        } catch (e) {
          console.warn('[groupcall] setRemoteDescription failed:', e);
        }
      }
    } else if (signal.type === 'GROUP_ICE' && signal.candidate) {
      const entry = peersRef.current.get(fromId);
      const init = JSON.parse(signal.candidate) as RTCIceCandidateInit;
      if (entry) {
        if (entry.pc.remoteDescription) {
          try { await entry.pc.addIceCandidate(new RTCIceCandidate(init)); } catch (e) {}
        } else {
          entry.pendingIce.push(init);
        }
      }
    } else if (signal.type === 'GROUP_LEAVE') {
      removePeer(fromId);
    }
  }, [createPeer, removePeer]);

  // ---- join / leave ------------------------------------------------------------
  const joinCall = useCallback(async (callId: string, roomId: string, roomName: string, isHost: boolean = false) => {
    if (callRef.current?.callId === callId) return;
    isHostRef.current = isHost;
    // Open camera/mic
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      localStreamRef.current = stream;
      facingModeRef.current = 'user';
      setLocalStream(stream);
    } catch (e) {
      console.warn('[groupcall] getUserMedia failed:', e);
    }

    const info = { callId, roomId, roomName };
    callRef.current = info;
    setActiveCall(info);
    setParticipants([
      { userId: myIdRef.current || 'me', name: myName + ' (You)', avatar: myAvatar, stream: localStreamRef.current, isMe: true },
    ]);
    setIsMuted(false);
    setIsVideoOff(false);

    // Listen for group signals (BroadcastChannel + localStorage + server poll on the room channel)
    const off = callSignaling.onSignal(handleGroupSignal);
    const stopPoll = callSignaling.startServerPoll(signalTarget(callId));
    // Route server-polled signals through the same handler — startServerPoll
    // emits to all onSignal listeners, so `off` above already covers it.
    pollStopRef.current = () => { off(); stopPoll(); };

    // Announce ourselves (a few times, in case someone joins right after)
    sendGroupSignal('GROUP_JOIN', callId, { meta: { name: myName, avatar: myAvatar } });
    setTimeout(() => { if (callRef.current?.callId === callId) sendGroupSignal('GROUP_JOIN', callId, { meta: { name: myName, avatar: myAvatar } }); }, 3000);

    // Heartbeat: re-announce every 20s so late joiners discover us
    heartbeatRef.current = setInterval(() => {
      if (callRef.current?.callId === callId) {
        sendGroupSignal('GROUP_JOIN', callId, { meta: { name: myName, avatar: myAvatar } });
      }
    }, 20000);

    // Host heartbeat: keeps the server listing alive (pruned after 2 min silence)
    if (isHost) {
      groupCallsApi.heartbeat(callId).catch(() => {});
      hostHeartbeatRef.current = setInterval(() => {
        if (callRef.current?.callId === callId) {
          groupCallsApi.heartbeat(callId).catch(() => {});
        }
      }, 60000);
    }
  }, [handleGroupSignal, myName, myAvatar]);

  const leaveCall = useCallback(() => {
    const call = callRef.current;
    const wasHost = isHostRef.current;
    if (call) {
      try { sendGroupSignal('GROUP_LEAVE', call.callId); } catch (e) {}
      // Host ending the call removes it from the directory for everyone
      if (wasHost) {
        groupCallsApi.end(call.callId).catch(() => {});
      }
    }
    if (pollStopRef.current) { pollStopRef.current(); pollStopRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (hostHeartbeatRef.current) { clearInterval(hostHeartbeatRef.current); hostHeartbeatRef.current = null; }
    isHostRef.current = false;
    if (isRecording) stopRecording();
    peersRef.current.forEach((entry) => { try { entry.pc.close(); } catch (e) {} });
    peersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setParticipants([]);
    setActiveCall(null);
    callRef.current = null;
  }, [isRecording]);

  // ---- local controls ------------------------------------------------------------
  const toggleMute = useCallback(() => {
    const ls = localStreamRef.current;
    if (ls) {
      ls.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    const ls = localStreamRef.current;
    if (ls) {
      ls.getVideoTracks().forEach((t) => { t.enabled = isVideoOff; });
    }
    setIsVideoOff(!isVideoOff);
  }, [isVideoOff]);

  const switchCamera = useCallback(async () => {
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = stream.getVideoTracks()[0];
      if (!newVideoTrack) return;
      // Swap on every peer connection
      for (const [, entry] of peersRef.current) {
        const sender = entry.pc.getSenders().find((sn) => sn.track && sn.track.kind === 'video');
        if (sender) {
          try { await sender.replaceTrack(newVideoTrack); } catch (e) {}
        }
      }
      const ls = localStreamRef.current;
      if (ls) {
        ls.getVideoTracks().forEach((t) => t.stop());
        ls.getVideoTracks().forEach((t) => ls.removeTrack(t));
        ls.addTrack(newVideoTrack);
        setLocalStream(ls);
        setParticipants((prev) => prev.map((p) => (p.isMe ? { ...p, stream: ls } : p)));
      }
      facingModeRef.current = nextFacing;
    } catch (e) {
      console.warn('[groupcall] switchCamera failed:', e);
    }
  }, []);

  // ---- recording: composite all tiles to a canvas + mix audio ----------------------
  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, W, H);

    const tiles: { el: HTMLVideoElement; name: string }[] = [];
    videoElsRef.current.forEach((el, key) => {
      const p = participants.find((pp) => pp.userId === key || (pp.isMe && key === 'me'));
      if (el && el.videoWidth > 0) tiles.push({ el, name: p?.name || '' });
    });

    const n = Math.max(tiles.length, 1);
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cw = W / cols, ch = H / rows;

    tiles.forEach(({ el, name }, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = col * cw, y = row * ch;
      // cover-fit
      const vw = el.videoWidth, vh = el.videoHeight;
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale, dh = vh * scale;
      const dx = x + (cw - dw) / 2, dy = y + (ch - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, ch);
      ctx.clip();
      ctx.drawImage(el, dx, dy, dw, dh);
      // name tag
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 8, y + ch - 30, ctx.measureText(name).width + 20, 22);
      ctx.fillStyle = '#fcd34d';
      ctx.font = '14px sans-serif';
      ctx.fillText(name, x + 16, y + ch - 14);
      ctx.restore();
      // cell border
      ctx.strokeStyle = 'rgba(217,119,6,0.5)';
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    });

    rafRef.current = requestAnimationFrame(drawLoop);
  }, [participants]);

  const registerVideoEl = useCallback((key: string, el: HTMLVideoElement | null) => {
    if (el) videoElsRef.current.set(key, el);
    else videoElsRef.current.delete(key);
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording || !callRef.current) return;
    try {
      // 1. Canvas composite
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvasRef.current = canvas;
      const canvasStream = canvas.captureStream(30);

      // 2. Mix all audio (local + remotes) into one track
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      const mixSource = (stream: MediaStream | null) => {
        if (!stream) return;
        stream.getAudioTracks().forEach((track) => {
          try {
            const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
            src.connect(dest);
          } catch (e) {}
        });
      };
      mixSource(localStreamRef.current);
      participants.forEach((p) => { if (!p.isMe) mixSource(p.stream); });

      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';
      const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mime.split(';')[0] });
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
        a.href = url;
        a.download = `bible-study-${stamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
      };
      recorder.start(1000);
      recorderRef.current = recorder;

      // 3. Start the draw loop + timer
      rafRef.current = requestAnimationFrame(drawLoop);
      setRecordingSecs(0);
      recordTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
      setIsRecording(true);
    } catch (e) {
      console.warn('[groupcall] startRecording failed:', e);
    }
  }, [isRecording, participants, drawLoop]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    try {
      cancelAnimationFrame(rafRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recorderRef.current?.stop();
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    } catch (e) {}
    recorderRef.current = null;
    canvasRef.current = null;
    setIsRecording(false);
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRef.current) {
        peersRef.current.forEach((entry) => { try { entry.pc.close(); } catch (e) {} });
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <GroupCallContext.Provider
      value={{
        activeCall,
        participants,
        localStream,
        isMuted,
        isVideoOff,
        isRecording,
        recordingSecs,
        joinCall,
        leaveCall,
        toggleMute,
        toggleVideo,
        switchCamera,
        startRecording,
        stopRecording,
        registerVideoEl,
      }}
    >
      {children}
    </GroupCallContext.Provider>
  );
};

export const useGroupCall = (): GroupCallContextType => {
  const context = useContext(GroupCallContext);
  if (!context) {
    throw new Error('useGroupCall must be used within a GroupCallProvider');
  }
  return context;
};
