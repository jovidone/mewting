import type { RoomId } from '@mewting/shared';

export type VoiceState = 'disconnected' | 'connecting' | 'muted' | 'active' | 'speaking';
type VoiceRoster = ReadonlyMap<string, VoiceState>;
const empty: VoiceRoster = new Map();

export function voiceState(participant: { isMicrophoneEnabled: boolean; isSpeaking: boolean }): VoiceState {
  if (!participant.isMicrophoneEnabled) return 'muted';
  return participant.isSpeaking ? 'speaking' : 'active';
}

export class VoicePresence {
  private roomId: RoomId | null = null;
  private roster: VoiceRoster = empty;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  get = (roomId: RoomId): VoiceRoster => this.roomId === roomId ? this.roster : empty;

  replace(roomId: RoomId, roster: VoiceRoster) {
    if (this.roomId === roomId && this.roster.size === roster.size
      && [...roster].every(([id, state]) => this.roster.get(id) === state)) return;
    this.roomId = roomId;
    this.roster = roster;
    this.listeners.forEach((listener) => listener());
  }

  clear(roomId: RoomId) {
    if (this.roomId === roomId) this.replace(roomId, empty);
  }
}
