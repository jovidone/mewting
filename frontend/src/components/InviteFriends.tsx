import { useEffect, useRef, useState } from 'react';
import type { RoomId } from '@mewting/shared';
import { invitationUrl } from '../invitations';

export function InviteFriends({ roomId, ready }: { roomId: RoomId; ready: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const field = useRef<HTMLInputElement>(null);
  const url = invitationUrl(window.location.origin, roomId);

  useEffect(() => {
    if (status === 'manual') {
      field.current?.focus();
      field.current?.select();
    }
  }, [status]);

  async function copy() {
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }

  return <div className="invite-friends">
    <button className="secondary-button" type="button" disabled={!ready || status === 'copying'}
      onClick={() => void copy()}>Invite Friends</button>
    <div role="status">{status === 'copied' ? 'Invitation link copied.' : status === 'manual' ? 'Copy the link below to share this room.' : ''}</div>
    {status === 'manual' && <input ref={field} aria-label="Invitation URL" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />}
  </div>;
}
