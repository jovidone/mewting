export const MAX_NICKNAME_LENGTH = 20;
export const CAT_COLORS = [
  { id: 'peach', name: 'Peach', hex: '#efb9a5' },
  { id: 'sage', name: 'Sage', hex: '#b8c9a4' },
  { id: 'lavender', name: 'Lavender', hex: '#c7b9dc' },
  { id: 'butter', name: 'Butter', hex: '#ecd797' },
  { id: 'sky', name: 'Sky', hex: '#a9cbdc' },
  { id: 'rose', name: 'Rose', hex: '#e3b6c5' },
] as const;

export type CatColorId = (typeof CAT_COLORS)[number]['id'];
export interface PlayerPreferences {
  nickname: string;
  color: CatColorId;
}

export interface LocalPlayer extends PlayerPreferences {
  // Server-issued while connected; an offline preview ID is never authorization.
  id: string;
}

export function isCatColor(value: unknown): value is CatColorId {
  return CAT_COLORS.some((color) => color.id === value);
}

export function nicknameError(value: string): string | null {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) return 'Please use visible characters for your nickname.';
  const length = Array.from(value.trim()).length;
  if (length === 0) return 'Give your cat a nickname first.';
  if (length > MAX_NICKNAME_LENGTH) return `Keep your nickname to ${MAX_NICKNAME_LENGTH} characters.`;
  return null;
}

export function parsePreferences(value: unknown): PlayerPreferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.nickname !== 'string' || nicknameError(candidate.nickname) || !isCatColor(candidate.color)) return null;
  return { nickname: candidate.nickname.trim(), color: candidate.color };
}

