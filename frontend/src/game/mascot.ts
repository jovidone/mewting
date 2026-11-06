import { Container, Graphics, Text } from 'pixi.js';
import { CAT_COLORS, type LocalPlayer } from '@mewting/shared';

export function createMascot(player: LocalPlayer) {
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 7, 28, 8).fill({ color: '#544e45', alpha: 0.13 });
  const body = new Container();
  const coat = CAT_COLORS.find((entry) => entry.id === player.color)!.hex;
  const tail = new Graphics().moveTo(21, -4).bezierCurveTo(47, 6, 43, -14, 40, -17).stroke({ color: coat, width: 9, cap: 'round' });
  const shape = new Graphics()
    .moveTo(-23, -25).lineTo(-23, -52).quadraticCurveTo(-23, -56, -19, -53).lineTo(-7, -41)
    .quadraticCurveTo(0, -44, 9, -41).lineTo(22, -53).quadraticCurveTo(25, -55, 25, -51)
    .lineTo(25, -24).bezierCurveTo(40, 8, 18, 9, 0, 9).bezierCurveTo(-29, 9, -39, 4, -23, -25).fill(coat)
    .poly([-19, -46, -17, -32, -10, -39]).fill({ color: '#ffffff', alpha: 0.4 })
    .poly([20, -46, 18, -32, 11, -39]).fill({ color: '#ffffff', alpha: 0.4 })
    .ellipse(0, -2, 16, 9).fill({ color: '#ffffff', alpha: 0.2 });
  const face = new Graphics()
    .ellipse(-10, -25, 1.8, 2.8).fill('#4c4c42').ellipse(11, -25, 1.8, 2.8).fill('#4c4c42')
    .ellipse(-17, -18, 4.5, 2.4).fill({ color: '#d98f87', alpha: 0.45 })
    .ellipse(18, -18, 4.5, 2.4).fill({ color: '#d98f87', alpha: 0.45 })
    .moveTo(-2, -19).lineTo(1, -17).lineTo(4, -19).stroke({ color: '#4c4c42', width: 1.5, cap: 'round' })
    .moveTo(1, -17).quadraticCurveTo(-2, -11, -6, -15).moveTo(1, -17).quadraticCurveTo(5, -11, 8, -15)
    .stroke({ color: '#4c4c42', width: 1.4, cap: 'round' });
  body.addChild(tail, shape, face);
  const label = new Text({ text: player.nickname, style: { fontFamily: 'Segoe UI, sans-serif', fontSize: 13, fontWeight: '600', fill: '#4e5747' }, resolution: 2 });
  label.anchor.set(0.5);
  label.scale.set(Math.min(1, 144 / Math.max(1, label.width)));
  label.position.set(0, -76);
  const labelBackground = new Graphics().roundRect(-label.width / 2 - 10, -87, label.width + 20, 23, 9).fill({ color: '#ffffff', alpha: 0.94 });
  const marker = new Graphics().poly([-3, -61, 3, -61, 0, -57]).fill('#8a9978');
  root.addChild(shadow, body, labelBackground, label, marker);
  return { root, body, shadow };
}

