import { useEffect, useRef, useState } from 'react';
import type { LocalPlayer, RoomDefinition } from '@mewting/shared';
import type { GameController } from './engine';
import type { RealtimeClient } from '../network/RealtimeClient';

export function GameCanvas({ player, room, paused, network }: { player: LocalPlayer; room: RoomDefinition; paused: boolean; network?: RealtimeClient }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<GameController | null>(null);
  const latest = useRef({ player, room, paused });
  latest.current = { player, room, paused };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [failure, setFailure] = useState('');
  const [focused, setFocused] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let ownedGame: GameController | null = null;
    setStatus('loading');
    void (async () => {
      try {
        const { mountGame } = await import('./engine');
        if (disposed) return;
        const game = await mountGame(host, latest.current.player, latest.current.room, network, () => disposed);
        if (!game) return;
        if (disposed) { game.destroy(); return; }
        ownedGame = game;
        controller.current = game;
        game.setRoom(latest.current.room);
        game.setPlayer(latest.current.player);
        game.setPaused(latest.current.paused);
        setStatus('ready');
        if (!latest.current.paused) host.focus({ preventScroll: true });
      } catch (error) {
        console.error('Could not start the Mewting canvas.', error, error instanceof Error ? error.stack : undefined);
        if (!disposed) {
          if (controller.current === ownedGame) controller.current = null;
          try {
            ownedGame?.destroy();
          } catch (cleanupError) {
            console.error('Mewting canvas cleanup failed.', cleanupError);
          }
          setFailure(error instanceof Error ? error.message : String(error));
          setStatus('error');
        }
      }
    })();
    return () => {
      disposed = true;
      if (controller.current === ownedGame) controller.current = null;
      ownedGame?.destroy();
    };
  }, [attempt, network]);

  useEffect(() => { controller.current?.setRoom(room); }, [room]);
  useEffect(() => { controller.current?.setPlayer(player); }, [player]);
  useEffect(() => { controller.current?.setPaused(paused); }, [paused]);

  return <section className={`game-frame ${focused ? 'game-focused' : ''}`} aria-label="Room exploration">
    <div className="canvas-topline"><span><span className="tiny-dot" />{room.name}</span><span>A little room for everyone</span></div>
    <div className="canvas-area">
      <div ref={hostRef} className="game-host" tabIndex={paused ? -1 : 0} role="region"
        aria-label={`${room.name} game canvas`} aria-describedby="movement-help"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {status === 'loading' && <div className="canvas-message" role="status"><span className="loading-paw">✳</span>Fluffing the cushions…</div>}
      {status === 'error' && <div className="canvas-message" role="alert"><strong>The room canvas failed to start.</strong><p>{failure || 'See the browser console for details.'}</p><button className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
    </div>
    <div className="canvas-controls" id="movement-help">
      <div className="key-hint"><span className="key-set"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>or arrow keys to wander</span></div>
      <button type="button" className="focus-button" disabled={status !== 'ready' || paused} onClick={() => hostRef.current?.focus()}>{focused ? 'You’re free to wander' : 'Click here to wander'}<span aria-hidden="true">↗</span></button>
    </div>
    <span className="sr-only" aria-live="polite">You are in {room.name}. {room.description}</span>
  </section>;
}
