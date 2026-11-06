export const ROOM_IDS = ['lobby', 'pawffice', 'mewting-room', 'catfe', 'catnap-corner'] as const;
export type RoomId = (typeof ROOM_IDS)[number];

export interface Position {
  x: number;
  y: number;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  purpose: string;
  description: string;
  note: string;
  accent: string;
  floor: string;
  wall: string;
  rug: string;
  spawn: Readonly<Position>;
}

export const ROOM_WIDTH = 960;
export const ROOM_HEIGHT = 640;
export const MOVEMENT_SPEED = 220;
export const MAX_FRAME_SECONDS = 0.05;
// Room-space coordinates, independent of canvas size. Leave space for ears and labels.
export const WALK_BOUNDS = { left: 80, right: 880, top: 150, bottom: 570 } as const;

export const ROOMS: readonly RoomDefinition[] = [
  {
    id: 'lobby', name: 'The Lobby', purpose: 'A little hello',
    description: 'Come on in. Make yourself at home.',
    note: 'Every good gathering starts with a little hello.',
    accent: '#8d9c79', floor: '#f5ead7', wall: '#e4e8da', rug: '#d5dfca',
    spawn: { x: 480, y: 435 },
  },
  {
    id: 'pawffice', name: 'Pawffice', purpose: 'Find your focus',
    description: 'Big ideas. Small paws. Plenty of desk space.',
    note: 'A cozy spot for your next bright idea.',
    accent: '#819aab', floor: '#e9eff0', wall: '#dce6ec', rug: '#c8dce4',
    spawn: { x: 480, y: 450 },
  },
  {
    id: 'mewting-room', name: 'Mewting Room', purpose: 'Better together',
    description: 'Pull up a chair. There is room for your ideas.',
    note: 'Good things happen around a shared table.',
    accent: '#a08cac', floor: '#f0eaf1', wall: '#e8dfed', rug: '#ddd0e6',
    spawn: { x: 480, y: 490 },
  },
  {
    id: 'catfe', name: 'Catfé', purpose: 'Take a little break',
    description: 'A warm cup and a change of scenery.',
    note: 'Your next great idea might need a coffee break.',
    accent: '#bc9278', floor: '#f4e7d9', wall: '#eed9c9', rug: '#e5c8b4',
    spawn: { x: 480, y: 460 },
  },
  {
    id: 'catnap-corner', name: 'Catnap Corner', purpose: 'Just breathe',
    description: 'Slow down. Even busy paws need a pause.',
    note: 'Doing a little less is perfectly okay here.',
    accent: '#9795af', floor: '#ecebf3', wall: '#e0e1ee', rug: '#d4d1e5',
    spawn: { x: 480, y: 440 },
  },
];

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === 'string' && ROOM_IDS.some((id) => id === value);
}

export function getRoom(id: RoomId): RoomDefinition {
  const room = ROOMS.find((candidate) => candidate.id === id);
  if (!room) throw new Error('Unknown room');
  return room;
}

export interface MovementInput {
  x: number;
  y: number;
}

export function advancePosition(position: Position, input: MovementInput, seconds: number): Position {
  if (![position.x, position.y, input.x, input.y, seconds].every(Number.isFinite)) {
    throw new RangeError('Movement values must be finite');
  }
  const magnitude = Math.hypot(input.x, input.y);
  const divisor = Math.max(1, magnitude);
  const distance = MOVEMENT_SPEED * Math.min(MAX_FRAME_SECONDS, Math.max(0, seconds));
  return {
    x: Math.max(WALK_BOUNDS.left, Math.min(WALK_BOUNDS.right, position.x + input.x / divisor * distance)),
    y: Math.max(WALK_BOUNDS.top, Math.min(WALK_BOUNDS.bottom, position.y + input.y / divisor * distance)),
  };
}

