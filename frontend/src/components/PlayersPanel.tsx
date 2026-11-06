import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = toggle.current!;
    const popover = panel.current!;
    const main = trigger.closest('.room-main');
    let frame = 0;
    let previous = '';
    const position = () => {
      const edge = 12;
      const gap = 8;
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0;
      const y = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? document.documentElement.clientHeight;
      const anchor = trigger.getBoundingClientRect();
      const panelWidth = Math.min(280, width - 2 * edge);
      const availableHeight = Math.min(320, height - 2 * edge);
      const below = y + height - edge - anchor.bottom - gap;
      const above = anchor.top - gap - y - edge;
      const list = popover.querySelector('.players-list');
      const preferredHeight = Math.min(availableHeight, popover.offsetHeight +
        (list ? list.scrollHeight - list.clientHeight : 0));
      const centered = width <= 480 || Math.max(below, above) < 120;
      const flip = !centered && below < preferredHeight && above > below;
      const right = x + width - edge - panelWidth;
      const left = Math.min(right, Math.max(x + edge, main?.getBoundingClientRect().left ?? 0));
      const panelX = centered ? x + (width - panelWidth) / 2 : Math.min(right, Math.max(left, anchor.right - panelWidth));
      const panelY = centered ? y + height / 2 : flip ? anchor.top - gap : anchor.bottom + gap;
      const maxHeight = centered ? availableHeight : Math.min(availableHeight, flip ? above : below);
      const style = `left:${panelX}px;top:${panelY}px;width:${panelWidth}px;max-height:${maxHeight}px;` +
        `transform:translateY(${centered ? '-50%' : flip ? '-100%' : '0'});`;
      if (style !== previous) {
        popover.style.cssText = style;
        previous = style;
      }
      // The trigger can move without resizing, such as when the room actions wrap.
      frame = requestAnimationFrame(position);
    };
    position();
    popover.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const path = event.composedPath();
      if (!path.includes(trigger) && !path.includes(popover)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      if (popover.contains(document.activeElement)) trigger.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const count = props.players.length;
  return <div>
    <button ref={toggle} className="secondary-button" type="button" aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? id : undefined} aria-label={`Who's here? ${count} ${count === 1 ? 'cat' : 'cats'} here`}
      onClick={() => setOpen(!open)}>{count} {count === 1 ? 'cat' : 'cats'} here <span aria-hidden="true">⌄</span></button>
    {open && createPortal(<section ref={panel} id={id} className="players-popover"
      role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <div className="players-popover-heading">
        <h2 id={`${id}-title`}>Who's here?</h2>
        <button type="button" aria-label="Close players panel" onClick={() => {
          setOpen(false);
          toggle.current?.focus();
        }}>×</button>
      </div>
      <PlayerList {...props} />
    </section>, document.body)}
  </div>;
}
