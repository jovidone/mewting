import { Container, Graphics, Text } from 'pixi.js';
import { ROOM_WIDTH } from '@mewting/shared';
import { speechText } from './speech-text';

const cream = '#fffaf0';
const border = '#d7cbb8';

export function createSpeechBubble(message: string) {
  const root = new Container({ eventMode: 'none', visible: false });
  const label = new Text({ text: speechText(message), resolution: 2,
    style: { fontFamily: 'Segoe UI, sans-serif', fontSize: 14, fill: '#494d40' } });
  label.anchor.set(0.5);
  label.scale.set(Math.min(1, 290 / Math.max(1, label.width)));
  label.y = -13;

  const width = label.width + 20;
  const tail = new Graphics().poly([-5, -1, 0, 6, 5, -1]).fill(cream).stroke({ color: border, width: 1 });
  const background = new Graphics().roundRect(-width / 2, -26, width, 26, 8)
    .fill(cream).stroke({ color: border, width: 1 });
  root.addChild(background, tail, label);

  return {
    root,
    place(x: number, y: number) {
      const inset = width / 2 + 4;
      const center = Math.max(inset, Math.min(ROOM_WIDTH - inset, x));
      root.position.set(center, y - 99);
      tail.x = x - center;
      root.visible = true;
    },
  };
}
