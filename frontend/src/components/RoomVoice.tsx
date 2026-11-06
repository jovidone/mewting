import { useLayoutEffect, useRef, useState } from 'react';
import { ConnectionState, MediaDeviceFailure, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import type { RoomId } from '@mewting/shared';
import type { RealtimeClient } from '../network/RealtimeClient';

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

export function RoomVoice({ network, roomId, enabled }: {
  network: RealtimeClient;
  roomId: RoomId;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<Status>('disconnected');
  const [count, setCount] = useState(0);
  const [mic, setMic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const active = useRef<Room | null>(null);
  const audioHost = useRef<HTMLDivElement>(null);
  const previous = useRef<Promise<void>>(Promise.resolve());

  useLayoutEffect(() => {
    setStatus(enabled ? 'connecting' : 'disconnected');
    setCount(0);
    setMic(false);
    setBusy(false);
    setBlocked(false);
    setError('');
    if (!enabled) return;

    const abort = new AbortController();
    const audio = new Map<RemoteTrack, { element: HTMLMediaElement; owner: string }>();
    let room: Room | undefined;
    const detach = (track: RemoteTrack) => {
      const entry = audio.get(track);
      if (!entry) return;
      track.detach(entry.element);
      entry.element.remove();
      audio.delete(track);
    };
    const detachAll = () => { for (const track of audio.keys()) detach(track); };
    const run = previous.current.then(async () => {
      if (abort.signal.aborted) return;
      const abortFetch = new AbortController();
      const timeout = setTimeout(() => abortFetch.abort(), 8000);
      const cancelFetch = () => abortFetch.abort();
      abort.signal.addEventListener('abort', cancelFetch, { once: true });
      let credentials: { url?: unknown; token?: unknown; error?: unknown };
      try {
        const response = await network.requestVoiceToken(abortFetch.signal);
        credentials = await response.json();
        if (!response.ok) throw new Error(typeof credentials.error === 'string' ? credentials.error : 'Voice token request failed.');
      } finally {
        clearTimeout(timeout);
        abort.signal.removeEventListener('abort', cancelFetch);
      }
      if (abort.signal.aborted) return;
      if (typeof credentials.url !== 'string' || typeof credentials.token !== 'string') {
        throw new Error('Voice configuration is unavailable.');
      }

      const connection = new Room({ publishDefaults: { stopMicTrackOnMute: true } });
      room = connection;
      const refresh = () => {
        if (abort.signal.aborted) return;
        const connected = connection.state === ConnectionState.Connected;
        setStatus(connected ? 'connected' : 'connecting');
        setCount(connected ? connection.remoteParticipants.size + 1 : 0);
        setMic(connected && connection.localParticipant.isMicrophoneEnabled);
        setBlocked(connected && !connection.canPlaybackAudio);
      };
      connection.on(RoomEvent.ConnectionStateChanged, refresh)
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          for (const [track, entry] of audio) if (entry.owner === participant.identity) detach(track);
          refresh();
        })
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.AudioPlaybackStatusChanged, refresh)
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (abort.signal.aborted || track.kind !== Track.Kind.Audio || audio.has(track)) return;
          const element = track.attach();
          audio.set(track, { element, owner: participant.identity });
          audioHost.current?.appendChild(element);
        })
        .on(RoomEvent.TrackUnsubscribed, detach)
        .on(RoomEvent.Disconnected, () => {
          detachAll();
          if (abort.signal.aborted) return;
          active.current = null;
          setMic(false);
          setCount(0);
          setBlocked(false);
          setStatus('error');
          setError('Voice disconnected. Retry to rejoin.');
        });
      await connection.connect(credentials.url, credentials.token, {
        autoSubscribe: true, maxRetries: 0, websocketTimeout: 8000, peerConnectionTimeout: 10000,
      });
      if (abort.signal.aborted) return;
      active.current = connection;
      refresh();
    }).catch(async (failure: unknown) => {
      detachAll();
      if (abort.signal.aborted) return;
      active.current = null;
      setStatus('error');
      setCount(0);
      setMic(false);
      setBlocked(false);
      setError(room ? 'Could not connect to LiveKit.' : failure instanceof Error && failure.name !== 'AbortError'
        ? failure.message : 'Voice token request timed out.');
      if (room) {
        room.removeAllListeners();
        await room.disconnect(true).catch(() => {});
      }
    });

    return () => {
      abort.abort();
      active.current = null;
      detachAll();
      room?.removeAllListeners();
      // Stop capture immediately, even if LiveKit is still completing an async connection.
      room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.stop();
      const disconnect = room?.disconnect(true).catch(() => {});
      previous.current = Promise.all([run, disconnect]).then(() => undefined);
    };
  }, [network, roomId, enabled, attempt]);

  async function toggleMic() {
    const room = active.current;
    if (!room || room.state !== ConnectionState.Connected || busy) return;
    setBusy(true);
    setError('');
    const enable = !room.localParticipant.isMicrophoneEnabled;
    try {
      const publication = await room.localParticipant.setMicrophoneEnabled(enable);
      if (active.current !== room) {
        publication?.track?.stop();
        return;
      }
      if (enable && !room.localParticipant.isMicrophoneEnabled) throw new Error('Microphone unavailable');
    } catch (failure) {
      if (active.current !== room) return;
      if (!enable) {
        room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.stop();
        await room.disconnect(true).catch(() => {});
      }
      if (active.current === room || !enable) {
        setError(MediaDeviceFailure.getFailure(failure) === MediaDeviceFailure.PermissionDenied
          ? 'Microphone permission denied.' : enable ? 'Microphone unavailable.' : 'Voice disconnected after a microphone error.');
      }
    } finally {
      if (active.current === room) {
        setMic(room.localParticipant.isMicrophoneEnabled);
        setBusy(false);
      }
    }
  }

  return <div className="room-voice">
    <div ref={audioHost} hidden />
    <span role="status">{status === 'connected' ? `Voice connected · ${count} · Mic ${mic ? 'active' : 'muted'}`
      : status === 'connecting' ? 'Connecting voice…' : status === 'error' ? 'Voice connection error' : 'Voice disconnected'}</span>
    <button type="button" className="secondary-button" disabled={status !== 'connected' || busy}
      onClick={() => void toggleMic()}>{mic ? 'Mute mic' : 'Unmute mic'}</button>
    {blocked && <button type="button" className="secondary-button" onClick={() => {
      const room = active.current;
      void room?.startAudio().catch(() => { if (active.current === room) setError('Sound is blocked. Try Enable Sound again.'); });
    }}>Enable Sound</button>}
    {status === 'error' && <button type="button" className="secondary-button" onClick={() => setAttempt(attempt + 1)}>Retry voice</button>}
    {error && <span role="status">{error}</span>}
  </div>;
}
