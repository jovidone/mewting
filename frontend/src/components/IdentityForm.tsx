import { useState, type FormEvent } from 'react';
import { CAT_COLORS, MAX_NICKNAME_LENGTH, nicknameError, type PlayerPreferences } from '@mewting/shared';
import { CatPortrait } from './CatPortrait';
import { Icon } from './Icon';

export function IdentityForm({ initial, editing = false, onSubmit }: {
  initial: PlayerPreferences | null;
  editing?: boolean;
  onSubmit: (preferences: PlayerPreferences) => void;
}) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [color, setColor] = useState(initial?.color ?? 'peach');
  const [error, setError] = useState<string | null>(null);
  const selected = CAT_COLORS.find((entry) => entry.id === color)!;

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = nicknameError(nickname);
    setError(validation);
    if (!validation) onSubmit({ nickname: nickname.trim(), color });
  }

  return <form onSubmit={submit} className="identity-form" noValidate>
    <div className="identity-preview"><CatPortrait color={selected.hex} /><span>{nickname.trim() || 'Your little alter ego'}</span></div>
    <div className="flex items-center justify-between gap-4">
      <label htmlFor="nickname">What should we call you?</label>
      <span className="character-count">{Array.from(nickname.trim()).length}/{MAX_NICKNAME_LENGTH}</span>
    </div>
    <input id="nickname" name="nickname" value={nickname} autoComplete="nickname" autoFocus
      placeholder="Your nickname" aria-invalid={Boolean(error)} aria-describedby={error ? 'nickname-error' : 'nickname-help'}
      onChange={(event) => { setNickname(event.target.value); setError(null); }} />
    {error ? <p id="nickname-error" className="form-error" role="alert">{error}</p>
      : <p id="nickname-help" className="field-hint">A name that feels like you. No account needed.</p>}
    <fieldset>
      <legend>Pick your coat <span>· {selected.name}</span></legend>
      <div className="color-options">
        {CAT_COLORS.map((entry) => <label className="color-option" key={entry.id} style={{ backgroundColor: entry.hex }}>
          <input type="radio" name="cat-color" value={entry.id} checked={color === entry.id}
            onChange={() => setColor(entry.id)} aria-label={entry.name} />
          {color === entry.id && <Icon name="check" size={19} />}
        </label>)}
      </div>
    </fieldset>
    <button className="primary-button" type="submit">{editing ? 'Save my cat' : 'Make yourself at home'}<Icon name="arrow" size={19} /></button>
    <p className="form-footnote">{editing ? 'Still you. Just a little more you.' : 'Your nickname and coat are saved on this device.'}</p>
  </form>;
}

