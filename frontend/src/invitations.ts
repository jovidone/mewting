import { isRoomId, type RoomId } from '@mewting/shared';

export function invitedRoom(search: string): RoomId | null {
  const value = new URLSearchParams(search).get('room');
  return isRoomId(value) ? value : null;
}

export function invitationUrl(origin: string, room: RoomId): string {
  const url = new URL('/', origin);
  url.searchParams.set('room', room);
  return url.href;
}
