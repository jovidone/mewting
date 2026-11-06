import { Application, Container } from 'pixi.js';
import { ROOM_HEIGHT, ROOM_WIDTH, advancePosition, type LocalPlayer, type PlayerSnapshot, type RoomDefinition } from '@mewting/shared';
import type { RealtimeClient } from '../network/RealtimeClient';
import { MOVEMENT_KEYS, readMovement } from './keyboard';
import { createMascot } from './mascot';
import { createScenery } from './scenery';

export interface GameController {
  setRoom: (room: RoomDefinition) => void;
  setPlayer: (player: LocalPlayer) => void;
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

export async function mountGame(host: HTMLDivElement, player: LocalPlayer, initialRoom: RoomDefinition, network: RealtimeClient | undefined,
  cancelled: () => boolean): Promise<GameController | null> {
  const app = new Application();
  let initialized = false;
  const cleanups: Array<() => void> = [];
  const keys = new Set<string>();
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    keys.clear();
    cleanups.forEach((cleanup) => cleanup());
    if (initialized) {
      app.stop();
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    }
  };
  try {
    await app.init({ width: ROOM_WIDTH, height: ROOM_HEIGHT, antialias: true,
      background: '#f6f5ed', resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
      preference: 'webgl', autoStart: false });
    initialized = true;
    if (cancelled()) { destroy(); return null; }
    const world = new Container();
    app.stage.addChild(world);
    let room = initialRoom;
    let scenery = createScenery(room);
    let mascot = createMascot(player);
    let position = { ...room.spawn };
    let currentPlayer = player;
    let paused = false;
    let time = 0;
    let facing = 1;
    const characters = new Container({ sortableChildren: true });
    world.addChild(scenery, characters);
    characters.addChild(mascot.root);
    const remotes = new Map<string, { player: PlayerSnapshot; mascot: ReturnType<typeof createMascot>; facing: number }>();
    let authority: PlayerSnapshot | null = null;
    let authorityAt = 0;
    let membershipVersion = 0;
    mascot.root.position.set(position.x, position.y);
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);

    const resize = () => {
      if (destroyed || cancelled()) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      app.renderer.resize(width, height);
      const scale = Math.min(width / ROOM_WIDTH, height / ROOM_HEIGHT);
      world.scale.set(scale);
      world.position.set((width - ROOM_WIDTH * scale) / 2, (height - ROOM_HEIGHT * scale) / 2);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    cleanups.push(() => observer.disconnect());
    resize();
    const clearKeys = () => { keys.clear(); network?.setInput({ x: 0, y: 0 }); };
    const syncScene = () => {
      if (!network || destroyed || cancelled()) return;
      const state = network.getScene();
      const snapshot = state.snapshot;
      if (!state.connected || !snapshot || snapshot.roomId !== room.id) {
        authority = null;
        for (const remote of remotes.values()) remote.mascot.root.destroy({ children: true });
        remotes.clear();
        clearKeys();
        return;
      }
      const own = snapshot.players.find((entry) => entry.id === state.playerId);
      if (own) {
        if (state.membershipVersion !== membershipVersion) {
          position = { ...own.position }; membershipVersion = state.membershipVersion; clearKeys();
        }
        authority = own; authorityAt = performance.now();
      }
      const ids = new Set(snapshot.players.map((entry) => entry.id));
      for (const [id, remote] of remotes) if (!ids.has(id) || id === state.playerId) {
        remote.mascot.root.destroy({ children: true }); remotes.delete(id);
      }
      for (const entry of snapshot.players) {
        if (entry.id === state.playerId) continue;
        let remote = remotes.get(entry.id);
        if (remote && (remote.player.nickname !== entry.nickname || remote.player.color !== entry.color)) {
          remote.mascot.root.destroy({ children: true }); remotes.delete(entry.id); remote = undefined;
        }
        if (!remote) {
          const sprite = createMascot(entry);
          sprite.root.position.set(entry.position.x, entry.position.y);
          characters.addChild(sprite.root);
          remote = { player: entry, mascot: sprite, facing: 1 };
          remotes.set(entry.id, remote);
        }
        remote.player = entry;
      }
    };
    if (network) cleanups.push(network.subscribeScene(syncScene));
    cleanups.push(clearKeys);
    syncScene();
    const keydown = (event: KeyboardEvent) => {
      if (event.target !== host || paused || event.altKey || event.ctrlKey || event.metaKey || !MOVEMENT_KEYS.has(event.code)) return;
      event.preventDefault();
      keys.add(event.code);
    };
    const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
    const focus = () => { if (!paused) host.focus({ preventScroll: true }); };
    const visibility = () => {
      clearKeys();
      if (document.hidden) app.stop();
      else app.start();
    };
    host.addEventListener('keydown', keydown);
    host.addEventListener('pointerdown', focus);
    host.addEventListener('blur', clearKeys);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', visibility);
    cleanups.push(() => {
      host.removeEventListener('keydown', keydown);
      host.removeEventListener('pointerdown', focus);
      host.removeEventListener('blur', clearKeys);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', visibility);
    });
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    app.ticker.maxFPS = 60;
    app.ticker.add((ticker) => {
      const input = paused ? { x: 0, y: 0 } : readMovement(keys);
      network?.setInput(input);
      const next = advancePosition(position, input, ticker.deltaMS / 1000);
      const moving = next.x !== position.x || next.y !== position.y;
      position = next;
      if (authority) {
        // Predict locally for immediate feedback; converge to the server's bounded position.
        const projected = advancePosition(authority.position, authority.direction, Math.min(0.05, (performance.now() - authorityAt) / 1000));
        const distance = Math.hypot(projected.x - position.x, projected.y - position.y);
        const blend = distance > 100 ? 1 : 1 - Math.exp(-ticker.deltaMS / 110);
        position = { x: position.x + (projected.x - position.x) * blend, y: position.y + (projected.y - position.y) * blend };
      }
      time += Math.min(ticker.deltaMS / 1000, 0.05);
      if (input.x !== 0) facing = Math.sign(input.x);
      const bounce = motionPreference.matches ? 0 : Math.sin(time * (moving ? 17 : 2.5)) * (moving ? 2.5 : 0.8);
      mascot.root.position.set(position.x, position.y);
      mascot.root.zIndex = position.y;
      mascot.body.position.y = bounce;
      mascot.body.scale.set(facing * (1 + (moving && !motionPreference.matches ? Math.sin(time * 17) * 0.025 : 0)), 1);
      mascot.body.rotation = moving && !motionPreference.matches ? Math.sin(time * 17) * 0.045 : 0;
      mascot.shadow.scale.set(1 - Math.abs(bounce) * 0.018, 1);
      for (const remote of remotes.values()) {
        const sprite = remote.mascot;
        const dx = remote.player.position.x - sprite.root.x;
        const dy = remote.player.position.y - sprite.root.y;
        const blend = Math.hypot(dx, dy) > 150 ? 1 : 1 - Math.exp(-ticker.deltaMS / 75);
        sprite.root.x += dx * blend; sprite.root.y += dy * blend; sprite.root.zIndex = sprite.root.y;
        if (Math.abs(dx) > 0.5) remote.facing = Math.sign(dx);
        sprite.body.scale.x = remote.facing;
        sprite.body.y = motionPreference.matches ? 0 : Math.sin(time * (Math.hypot(dx, dy) > 1 ? 17 : 2.5)) * 1.8;
      }
    });
    app.render();
    if (!document.hidden) app.start();
    return {
      setRoom(nextRoom) {
        if (nextRoom.id === room.id) return;
        const nextScenery = createScenery(nextRoom);
        clearKeys();
        room = nextRoom;
        world.removeChild(scenery);
        scenery.destroy({ children: true });
        scenery = nextScenery;
        world.addChildAt(scenery, 0);
        position = { ...room.spawn };
        mascot.root.position.set(position.x, position.y);
        membershipVersion = 0;
        syncScene();
      },
      setPlayer(nextPlayer) {
        if (nextPlayer.nickname === currentPlayer.nickname && nextPlayer.color === currentPlayer.color) return;
        currentPlayer = nextPlayer;
        characters.removeChild(mascot.root);
        mascot.root.destroy({ children: true });
        mascot = createMascot(nextPlayer);
        mascot.root.position.set(position.x, position.y);
        characters.addChild(mascot.root);
      },
      setPaused(nextPaused) { paused = nextPaused; clearKeys(); },
      destroy,
    };
  } catch (error) {
    try {
      destroy();
    } catch (cleanupError) {
      console.error('Mewting canvas cleanup failed.', cleanupError);
    }
    throw error;
  }
}

