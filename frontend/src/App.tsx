import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CAT_COLORS, ROOMS, getRoom, type PlayerPreferences, type RoomId } from '@mewting/shared';
import { CatPortrait } from './components/CatPortrait';
import { IdentityForm } from './components/IdentityForm';
import { Icon, type IconName } from './components/Icon';
import { GameCanvas } from './game/GameCanvas';
import { readPreferences, savePreferences } from './preferences';
import { InviteFriends } from './components/InviteFriends';
import { invitedRoom } from './invitations';
import { RealtimeClient } from './network/RealtimeClient';

const roomIcons: Record<RoomId, IconName> = {
  lobby: 'home', pawffice: 'desk', 'mewting-room': 'meeting', catfe: 'coffee', 'catnap-corner': 'moon',
};

function Brand() {
  return <div className="brand"><span className="brand-cat"><CatPortrait color="#a7b68e" /></span>
    <div><span className="wordmark">mewting<span>.</span></span><p>A cozy place to meet</p></div>
  </div>;
}

export function App() {
  const [preferences] = useState(readPreferences);
  const [network] = useState(() => new RealtimeClient());
  const [invited] = useState(() => invitedRoom(window.location.search));
  const { self: player, roomId, status, error, transitioning } = useSyncExternalStore(network.subscribe, network.getState);
  const online = status === 'online';
  useEffect(() => () => network.dispose(), [network]);
  const [storageWarning, setStorageWarning] = useState(false);
  const [editing, setEditing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const room = getRoom(roomId);

  useEffect(() => {
    if (editing) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [editing]);

  async function updateIdentity(next: PlayerPreferences) {
    if (!network.getState().self) network.start(next, invited ?? 'lobby');
    else if (!(await network.updateProfile(next))) return;
    setStorageWarning(!savePreferences(next));
    setEditing(false);
  }

  return <div className="app">
    <header className="app-header"><Brand /><div className="header-meta"><span className="local-pill" role="status"><span />{online ? 'Online' : status === 'connecting' ? 'Connecting…' : 'Local session'}</span><span className="version-label">a little space to belong</span></div></header>
    {!player ? <main className="welcome-page">
      <div className="welcome-card">
        <section className="welcome-story">
          <span className="eyebrow"><Icon name="leaf" size={16} /> HELLO, YOU.</span>
          <h1>Small paws.<br />Big possibilities.</h1>
          <p>A cozy corner of the internet.<br />Pick your cat, find your favorite room,<br />and settle right in.</p>
          <div className="welcome-cats"><span className="little-spark spark-one">✧</span><CatPortrait color="#b8c9a4" /><CatPortrait color="#efb9a5" /><CatPortrait color="#c7b9dc" /><span className="little-spark spark-two">✧</span></div>
          <div className="welcome-caption"><span className="tiny-dot" /> Five little rooms. A world of your own.</div>
        </section>
        <section className="welcome-form"><span className="eyebrow">YOUR CAT, YOUR WAY</span><h2>Come as you are.</h2>
          {invited && <p>You’re invited to {getRoom(invited).name}.</p>}
          <IdentityForm initial={preferences} onSubmit={updateIdentity} /></section>
      </div>
      <p className="welcome-bottom">A quiet first look at Mewting. Explore at your own pace.</p>
    </main> : <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">FIND YOUR PLACE</span><span className="room-total">05</span></div>
        <nav aria-label="Rooms" className="room-navigation">
          {ROOMS.map((entry, index) => <button type="button" key={entry.id} aria-current={roomId === entry.id ? 'page' : undefined}
            className={`room-link ${roomId === entry.id ? 'active' : ''}`} disabled={transitioning || status === 'connecting'}
            onClick={() => void network.changeRoom(entry.id)}>
            <span className="room-icon" style={{ color: entry.accent }}><Icon name={roomIcons[entry.id]} size={22} /></span>
            <span className="room-link-copy"><strong>{entry.name}</strong><small>{entry.purpose}</small></span>
            <span className="room-index">{roomId === entry.id ? <span className="active-dot" /> : `0${index + 1}`}</span>
          </button>)}
        </nav>
        <div className="sidebar-note"><Icon name="leaf" size={23} /><p>A change of room.<br />A fresh little perspective.</p><span>Go where you feel good.</span></div>
        <button className="profile-button" type="button" onClick={() => setEditing(true)} ref={editButtonRef} aria-label="Edit your cat">
          <span className="profile-avatar"><CatPortrait color={CAT_COLORS.find((entry) => entry.id === player.color)!.hex} /></span>
          <span><strong>{player.nickname}</strong><small>That’s you!</small></span><Icon name="edit" size={17} />
        </button>
      </aside>
      <main className="room-main">
        <section className="room-heading" aria-labelledby="room-title">
          <div><div className="eyebrow room-breadcrumb">YOUR LITTLE WORLD <span>/</span> ROOM 0{ROOMS.findIndex((entry) => entry.id === roomId) + 1}</div>
            <h1 id="room-title">{room.name}<span style={{ color: room.accent }}>.</span></h1><p>{room.description}</p></div>
          <InviteFriends key={roomId} roomId={roomId} ready={online && !transitioning} />
        </section>
        {storageWarning && <p className="storage-warning" role="status">Your browser could not save your preferences. You can still explore; enter them again next time.</p>}
        {error && <p className="storage-warning" role="status">{error} {!online && <button type="button" onClick={network.retry}>Reconnect</button>}</p>}
        <GameCanvas player={player} room={room} paused={editing || transitioning} network={network} />
        <div className="under-room"><p><Icon name="leaf" size={17} />{room.note}</p></div>
        <footer className="room-footer"><span className="footer-flower">✳</span><span>A cozy place to be yourself.</span><span className="local-footnote">Mewting · v0.1</span></footer>
      </main>
    </div>}
    <dialog ref={dialogRef} className="profile-dialog" aria-labelledby="edit-title" onCancel={() => setEditing(false)}
      onClose={() => { setEditing(false); editButtonRef.current?.focus(); }}>
      {editing && player && <><button className="close-button" type="button" aria-label="Close profile editor" onClick={() => setEditing(false)}><Icon name="close" /></button>
        <span className="eyebrow">A LITTLE CHANGE</span><h2 id="edit-title">Make it feel like you.</h2>{online && error && <p role="alert">{error}</p>}<IdentityForm editing initial={player} onSubmit={updateIdentity} /></>}
    </dialog>
  </div>;
}
