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
  const [mode, setMode] = useState<'expanded' | 'minimized' | 'closed'>('expanded');
  const [readCount, setReadCount] = useState(receivedMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const unread = Math.max(0, receivedMessages - readCount);
  const ready = online && !transitioning;

  useEffect(() => {
    const element = log.current;
    if (element && follow.current) element.scrollTop = element.scrollHeight;
  }, [messages, mode]);

  function expand() {
    follow.current = true;
    setMode('expanded');
  }

  function collapse(next: 'minimized' | 'closed') {
    setReadCount(receivedMessages);
    setMode(next);
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

  if (mode === 'closed') return <button className="room-chat-launcher" type="button" onClick={expand}>
    Open chat {unread > 0 && <span className="room-chat-badge">{unread} unread</span>}
  </button>;

  return <aside className="room-chat" aria-label={`${roomName} chat`}>
    <header className="room-chat-header">
      {mode === 'minimized'
        ? <button type="button" onClick={expand}>Expand chat {unread > 0 && <span className="room-chat-badge">{unread} unread</span>}</button>
        : <><strong>Room chat</strong><button type="button" onClick={() => collapse('minimized')}>Minimize</button></>}
      <button type="button" aria-label="Close chat" onClick={() => collapse('closed')}>×</button>
    </header>
    {mode === 'expanded' && <>
      <p className="room-chat-status" role="status">{roomName} · {transitioning ? 'Changing rooms…' : online ? 'Online' : 'Disconnected'}</p>
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
    </>}
  </aside>;
}
