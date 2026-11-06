import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { CAT_COLORS, type LocalPlayer, type RoomId } from '@mewting/shared';
import type { VoicePresence, VoiceState } from '../network/VoicePresence';
import { CatPortrait } from './CatPortrait';

interface Props {
  players: LocalPlayer[];
  playerId: string;
  roomId: RoomId;
  voice: VoicePresence;
}

const labels: Record<VoiceState, string> = {
  disconnected: 'Voice disconnected',
  connecting: 'Voice connecting',
  muted: 'Mic muted',
  active: 'Mic active',
  speaking: 'Speaking',
};

function PlayerList({ players, playerId, roomId, voice }: Props) {
  const states = useSyncExternalStore(voice.subscribe, () => voice.get(roomId));
  if (!players.length) return <p className="players-empty">No cats online here.</p>;
  return <ul className="players-list" tabIndex={0} aria-label="Players in this room">
    {players.map((player) => {
      const state = states.get(player.id) ?? 'disconnected';
      return <li key={player.id}>
        <CatPortrait color={CAT_COLORS.find(({ id }) => id === player.color)!.hex} />
        <div><strong>{player.nickname}{player.id === playerId ? ' (You)' : ''}</strong>
          <span data-speaking={state === 'speaking'}>{labels[state]}</span></div>
      </li>;
    })}
  </ul>;
}

export function PlayersPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!event.composedPath().includes(root.current!)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpen(false);
      if (root.current?.contains(document.activeElement)) toggle.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const count = props.players.length;
  return <div className="players-panel" ref={root}>
    <button ref={toggle} className="secondary-button" type="button" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-label={`Who's here? ${count} ${count === 1 ? 'cat' : 'cats'} here`}
      onClick={() => setOpen(!open)}>{count} {count === 1 ? 'cat' : 'cats'} here <span aria-hidden="true">⌄</span></button>
    {open && <section id={id} className="players-popover" aria-label="Who's here?">
      <h2>Who's here?</h2><PlayerList {...props} />
    </section>}
  </div>;
}
