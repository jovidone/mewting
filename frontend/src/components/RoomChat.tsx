import { useEffect, useRef, useState } from 'react';
import { CHAT_LIMIT, type ChatMessage } from '@mewting/shared';
import './room-chat.css';

interface Props {
  roomName: string;
  messages: ChatMessage[];
  receivedMessages: number;
  online: boolean;
  transitioning: boolean;
  send: (text: string) => Promise<string | null>;
}

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function RoomChat({ roomName, messages, receivedMessages, online, transitioning, send }: Props) {
  const [open, setOpen] = useState(true);
  const [readCount, setReadCount] = useState(receivedMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const follow = useRef(true);
  const unread = Math.max(0, receivedMessages - readCount);
  const ready = online && !transitioning;

  useEffect(() => {
    const element = log.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (focusToggle.current) {
      focusToggle.current = false;
      toggle.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const element = panel.current;
    if (!open || !viewport || !element) return;
    const resize = () => {
      element.style.setProperty('--chat-visible-height', `${viewport.height}px`);
      element.style.setProperty('--chat-keyboard-offset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
    };
  }, [open]);

  function toggleChat() {
    focusToggle.current = true;
    setReadCount(receivedMessages);
    if (!open) follow.current = true;
    setOpen(!open);
  }

  async function submit() {
    const text = draft.trim();
    if (!ready || sending || !text) return;
    setSending(true);
    setError(null);
    follow.current = true;
    const failure = await send(text);
    setSending(false);
    if (failure) setError(failure);
    else setDraft((current) => current === draft ? '' : current);
  }

  if (!open) return <div className="room-chat-rail">
    <button ref={toggle} className="room-chat-launcher" type="button" onClick={toggleChat}
      aria-expanded={false} aria-label={unread ? `Open chat, ${unread} unread` : 'Open chat'} title="Open chat">
      <svg className={unread ? 'room-chat-paw has-unread' : 'room-chat-paw'} viewBox="0 0 32 32" aria-hidden="true">
        <ellipse cx="5.8" cy="12.2" rx="3.3" ry="4.5" transform="rotate(-25 5.8 12.2)" />
        <ellipse cx="12.4" cy="6.8" rx="3.3" ry="4.5" transform="rotate(-10 12.4 6.8)" />
        <ellipse cx="20.1" cy="6.8" rx="3.3" ry="4.5" transform="rotate(10 20.1 6.8)" />
        <ellipse cx="26.4" cy="12.2" rx="3.3" ry="4.5" transform="rotate(25 26.4 12.2)" />
        <path d="M7 24c0-3.6 5.6-10 9-10s9 6.4 9 10c0 3.1-2.6 4.7-5 4.7-1.8 0-2.6-1.2-4-1.2s-2.2 1.2-4 1.2c-2.4 0-5-1.6-5-4.7Z" />
      </svg>
      {unread > 0 && <span className="room-chat-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
  </div>;

  return <aside ref={panel} className="room-chat" aria-label={`${roomName} chat`}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
        event.preventDefault();
        toggleChat();
      }
    }}>
    <header className="room-chat-header">
      <div><p className="room-chat-label">Room chat</p><h2>{roomName}</h2>
        <p className="room-chat-status" role="status" data-online={ready}>
          {transitioning ? 'Changing rooms…' : online ? 'Online' : 'Disconnected'}
        </p>
      </div>
      <button ref={toggle} className="room-chat-hide" type="button" aria-label="Hide chat" aria-expanded={true}
        title="Hide chat" onClick={toggleChat}>×</button>
    </header>
      <div className="room-chat-log" ref={log} role="log" aria-label="Messages" tabIndex={0}
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
          follow.current = scrollHeight - scrollTop - clientHeight < 32;
        }}>
        {messages.length === 0 && <p className="room-chat-empty">It’s quiet here. Say hello!</p>}
        {messages.map((message) => <article key={message.id}>
          <header><strong>{message.nickname}</strong>
            <time dateTime={new Date(message.sentAt).toISOString()}>{time.format(message.sentAt)}</time>
          </header>
          <p>{message.text}</p>
        </article>)}
      </div>
      <form className="room-chat-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <textarea aria-label="Chat message" placeholder="Say something…" rows={2}
          value={draft} maxLength={CHAT_LIMIT} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }} />
        <button type="submit" disabled={!ready || sending || !draft.trim()}>Send</button>
      </form>
      {error && <p className="room-chat-error" role="alert">{error}</p>}
  </aside>;
}
