import { Container, Graphics, Text } from 'pixi.js';
import { ROOM_HEIGHT, ROOM_WIDTH, type RoomDefinition } from '@mewting/shared';

export function createScenery(room: RoomDefinition): Container {
  const scene = new Container();
  const shapes = new Graphics();
  scene.addChild(shapes);
  const rounded = (x: number, y: number, w: number, h: number, radius: number, fill: string) => {
    shapes.roundRect(x, y, w, h, radius).fill(fill);
  };
  const line = (x: number, y: number, x2: number, y2: number, color: string, width = 2, alpha = 1) => {
    shapes.moveTo(x, y).lineTo(x2, y2).stroke({ color, width, alpha, cap: 'round' });
  };
  const text = (value: string, x: number, y: number, size = 12, color = '#79816e') => {
    const label = new Text({ text: value, style: { fontFamily: 'Segoe UI, sans-serif', fontSize: size, fill: color, fontWeight: '500', letterSpacing: 1 }, resolution: 2 });
    label.anchor.set(0.5);
    label.position.set(x, y);
    scene.addChild(label);
  };
  const plant = (x: number, y: number, scale = 1) => {
    const foliage = new Graphics();
    foliage.ellipse(0, 6, 23, 7).fill({ color: '#696d53', alpha: 0.1 })
      .roundRect(-15, -20, 30, 28, 5).fill('#c6aa8b')
      .roundRect(-18, -23, 36, 8, 3).fill('#d6bda1')
      .moveTo(0, -23).lineTo(0, -65).stroke({ color: '#75886a', width: 4 })
      .ellipse(-13, -43, 17, 9).fill('#a1b28b')
      .ellipse(13, -54, 17, 10).fill('#8fa67d')
      .ellipse(-10, -65, 14, 9).fill('#b1c29b')
      .ellipse(7, -77, 10, 16).fill('#8fa67d');
    foliage.position.set(x, y);
    foliage.scale.set(scale);
    scene.addChild(foliage);
  };
  const window = (x: number, night = false) => {
    rounded(x, 43, 112, 64, 14, '#fcfaf2');
    rounded(x + 7, 49, 98, 50, 9, night ? '#a9adc9' : '#c6dce0');
    if (night) shapes.circle(x + 79, 64, 8).fill('#f7ebc4');
    else {
      shapes.ellipse(x + 30, 83, 26, 10).fill({ color: '#e9f2ed', alpha: 0.75 });
      shapes.ellipse(x + 75, 90, 31, 13).fill('#b7c7ad');
    }
    line(x + 56, 49, x + 56, 99, '#fcfaf2', 5);
    rounded(x - 4, 103, 120, 9, 3, '#d4c8b2');
  };
  const sofa = (x: number, y: number, color: string, width = 204) => {
    rounded(x + 6, y + 10, width, 92, 18, '#d7cfbe');
    rounded(x, y, width, 90, 18, color);
    rounded(x + 12, y + 9, width - 24, 26, 12, '#ffffff25');
    rounded(x + 22, y + 36, width / 2 - 25, 43, 10, '#ffffff30');
    rounded(x + width / 2 + 3, y + 36, width / 2 - 25, 43, 10, '#ffffff30');
    rounded(x - 6, y + 27, 22, 61, 9, color);
    rounded(x + width - 16, y + 27, 22, 61, 9, color);
    rounded(x + 27, y + 26, 33, 32, 7, '#efe6cf');
    line(x + 43, y + 29, x + 43, y + 54, '#d5c8ac', 2);
  };
  const mug = (x: number, y: number) => {
    shapes.circle(x + 10, y, 5).stroke({ color: '#fcf7eb', width: 3 });
    shapes.circle(x, y + 3, 10).fill('#b49b7e');
    shapes.circle(x, y, 10).fill('#fcf7eb');
    shapes.circle(x, y, 6).fill('#927360');
  };
  const roundTable = (x: number, y: number, radius = 40) => {
    shapes.ellipse(x + 2, y + 9, radius, radius * 0.68).fill('#d2b99c');
    shapes.ellipse(x, y, radius, radius * 0.68).fill('#e3cdb1');
    shapes.ellipse(x, y, radius - 6, radius * 0.68 - 5).stroke({ color: '#f4e4ce', width: 2 });
    mug(x - 9, y - 4);
  };
  const bookshelf = (x: number, y: number) => {
    rounded(x, y, 104, 78, 5, '#c7b092');
    rounded(x + 7, y + 6, 90, 28, 2, '#b39e83');
    rounded(x + 7, y + 41, 90, 28, 2, '#b39e83');
    const bookColors = ['#aebaa0', '#e2c4a5', '#adbdc5', '#c6b4cc', '#eee1ba'];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
      rounded(x + 12 + i * 13, y + 10 + row * 35, 10, 22 - i % 3 * 3, 1, bookColors[(i + row) % bookColors.length]!);
    }
  };

  rounded(0, 0, ROOM_WIDTH, ROOM_HEIGHT, 0, '#f6f5ed');
  rounded(31, 40, 902, 575, 25, '#e2dfd2');
  rounded(25, 26, 910, 580, 24, room.floor);
  rounded(25, 26, 910, 90, 24, room.wall);
  shapes.rect(25, 81, 910, 35).fill(room.wall);
  line(26, 115, 934, 115, '#c8bea6', 5, 0.5);
  for (let y = 165; y < 600; y += 49) {
    line(29, y, 931, y, '#c7bda8', 1, 0.24);
    for (let x = 80 + (y % 2) * 130; x < 925; x += 260) line(x, y - 47, x, y - 1, '#c7bda8', 1, 0.22);
  }
  window(115, room.id === 'catnap-corner');
  window(733, room.id === 'catnap-corner');
  rounded(371, 50, 218, 40, 9, '#fffdf4');
  text(room.id === 'lobby' ? 'MAKE YOURSELF AT HOME' : room.name.toLocaleUpperCase(), 480, 70, 10, room.accent);
  rounded(308, 250, 344, 282, 80, room.rug);
  shapes.roundRect(321, 263, 318, 256, 69).stroke({ color: '#ffffff', width: 2, alpha: 0.38 });
  plant(88, 169, 0.85);
  plant(871, 558, 1.05);

  switch (room.id) {
    case 'lobby':
      sofa(121, 197, '#b2bf9c');
      roundTable(231, 369, 48);
      bookshelf(738, 186);
      plant(793, 181, 0.55);
      rounded(704, 329, 110, 107, 36, '#d8bd9d');
      rounded(715, 336, 88, 77, 28, '#ead7b9');
      rounded(732, 345, 52, 43, 14, '#f8edcf');
      text('hello there', 480, 319, 22, '#7c906a');
      shapes.ellipse(467, 357, 10, 8).fill({ color: '#81986b', alpha: 0.3 });
      for (const [x, y] of [[454, 347], [464, 341], [475, 343], [481, 351]]) shapes.circle(x!, y!, 4).fill({ color: '#81986b', alpha: 0.3 });
      plant(133, 542, 1.1);
      break;
    case 'pawffice':
      for (const x of [126, 644]) {
        rounded(x + 43, 300, 90, 66, 23, '#adc0c9');
        rounded(x, 190, 186, 113, 12, '#c9b696');
        rounded(x + 4, 190, 178, 100, 10, '#ead9b8');
        rounded(x + 50, 206, 84, 48, 6, '#7d9093');
        rounded(x + 55, 210, 74, 37, 3, '#c0d5d5');
        rounded(x + 81, 254, 25, 6, 2, '#a9b2aa');
        rounded(x + 57, 267, 74, 13, 3, '#f7f0e3');
        mug(x + 157, 257);
      }
      bookshelf(111, 457);
      plant(777, 504, 1.1);
      text('one thing at a time', 480, 315, 17, '#7d9aa7');
      break;
    case 'mewting-room':
      for (const x of [347, 443, 539]) {
        rounded(x, 205, 73, 65, 20, '#b9a6c6');
        rounded(x, 394, 73, 65, 20, '#b9a6c6');
      }
      rounded(283, 268, 394, 134, 62, '#c4af97');
      rounded(280, 258, 400, 134, 62, '#e4d2b8');
      shapes.roundRect(291, 268, 378, 112, 52).stroke({ color: '#f8ead5', width: 2 });
      rounded(442, 294, 46, 59, 4, '#fbf5e9');
      line(452, 307, 480, 307, '#b9b2a9');
      line(452, 317, 475, 317, '#b9b2a9');
      mug(373, 318); mug(584, 318);
      rounded(106, 174, 106, 115, 9, '#c1b7c9');
      rounded(113, 181, 92, 101, 5, '#fff9ec');
      text('big ideas', 159, 210, 12, '#a28ca9');
      text('start small', 159, 234, 11, '#a28ca9');
      plant(789, 264, 1.2);
      break;
    case 'catfe':
      rounded(128, 168, 694, 91, 13, '#c9a887');
      rounded(124, 161, 702, 45, 12, '#ecd4b5');
      rounded(159, 139, 94, 53, 7, '#8e9b8c');
      rounded(173, 147, 50, 20, 3, '#c2d0ba');
      mug(207, 179); mug(284, 180);
      for (const x of [580, 618, 656]) rounded(x, 160, 25, 26, 5, '#faf0d8');
      plant(765, 173, 0.5);
      for (const x of [213, 742]) {
        rounded(x - 18, 324, 43, 37, 13, '#bb927e');
        rounded(x - 18, 434, 43, 37, 13, '#bb927e');
        roundTable(x, 396, 66);
      }
      text('stay a little longer', 480, 323, 17, '#b08973');
      break;
    case 'catnap-corner':
      sofa(134, 208, '#b6aec9', 225);
      rounded(210, 243, 82, 62, 14, '#e6dfed');
      line(226, 252, 226, 295, '#cbc0d6', 3);
      line(239, 252, 239, 295, '#cbc0d6', 3);
      shapes.ellipse(741, 337, 78, 61).fill('#c0b6d1');
      shapes.ellipse(741, 326, 68, 49).fill('#d7cde2');
      shapes.ellipse(741, 320, 34, 24).fill('#e9dfec');
      roundTable(194, 440, 45);
      rounded(340, 362, 72, 51, 20, '#c6ccbc');
      rounded(590, 361, 64, 49, 20, '#e1c9be');
      text('breathe in. breathe out.', 480, 298, 17, '#9692ab');
      plant(815, 203, 0.8);
      break;
  }
  rounded(420, 584, 120, 22, 8, '#e5d9c0');
  line(438, 595, 522, 595, '#f5ecda', 2);
  return scene;
}

