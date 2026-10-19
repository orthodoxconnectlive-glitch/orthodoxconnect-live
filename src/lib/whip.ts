/* Minimal WHIP/WHEP client for Cloudflare Stream, using native browser WebRTC.
   No dependencies. The WHIP publish URL embeds its own per-input secret, so it
   is only ever handed to the broadcaster — never to viewers. */

export async function whipPublish(whipUrl: string, mediaStream: MediaStream): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
  mediaStream.getTracks().forEach((track) => pc.addTransceiver(track, { direction: 'sendonly' }));
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(whipUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: offer.sdp,
    });
    if (!res.ok) throw new Error(`Broadcast failed (HTTP ${res.status})`);
    const answer = await res.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    return pc;
  } catch (err) {
    try { pc.close(); } catch {}
    throw err;
  }
}

// WHEP playback for viewers: recvonly PeerConnection against the playback URL.
export async function whepPlay(whepUrl: string, video: HTMLVideoElement): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  const stream = new MediaStream();
  pc.ontrack = (event) => {
    try { stream.addTrack(event.track); } catch {}
  };
  try { video.muted = true; } catch {}
  video.srcObject = stream;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: offer.sdp,
    });
    if (!res.ok) throw new Error(`Playback failed (HTTP ${res.status})`);
    const answer = await res.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    return pc;
  } catch (err) {
    try { pc.close(); } catch {}
    throw err;
  }
}

export function closePeerConnection(pc: RTCPeerConnection | null | undefined): void {
  try { if (pc) pc.close(); } catch {}
}
