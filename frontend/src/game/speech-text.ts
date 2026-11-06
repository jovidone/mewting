const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const limit = 35;
const suffix = '...';

export function speechText(message: string): string {
  const line = message.trim().replace(/\s+/gu, ' ');
  const characters = Array.from(segmenter.segment(line), ({ segment }) => segment);
  if (characters.length <= limit) return line;

  const budget = limit - suffix.length;
  const lastSpace = characters.lastIndexOf(' ', budget);
  const end = lastSpace >= 20 ? lastSpace : budget;
  return characters.slice(0, end).join('').trimEnd() + suffix;
}
