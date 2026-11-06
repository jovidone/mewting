import { parsePreferences, type PlayerPreferences } from '@mewting/shared';

export const PREFERENCES_KEY = 'mewting.preferences.v1';

export function readPreferences(): PlayerPreferences | null {
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    return saved ? parsePreferences(JSON.parse(saved) as unknown) : null;
  } catch {
    return null;
  }
}

export function savePreferences(preferences: PlayerPreferences): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
