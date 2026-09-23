import { useState, type FormEvent } from 'react';
import { ApiError, api, type FieldErrors, type PlanetSnapshot, type Player } from '../lib/api.ts';
import { Logo } from '../shell/icons.tsx';
import { bannerMessage, passwordMessage, usernameMessage } from './messages.ts';

interface AuthScreenProps {
  universeSpeed: number;
  /** `snapshot` is set only after register: the new Planet, for the one-time welcome window. */
  onAuthenticated: (player: Player, snapshot?: PlanetSnapshot) => void;
}

type Mode = 'login' | 'register';

/**
 * Variant A ("Airlock card", prototype #11): one centred card on the stage with a LOG IN /
 * REGISTER toggle that keeps the username, a SHOW/HIDE password toggle, hints under the fields
 * in register mode, inline field errors after submit, and a banner for credential / 429 errors.
 */
export function AuthScreen({ universeSpeed, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const register = mode === 'register';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    setFields({});
    setSubmitting(true);
    try {
      if (register) {
        const { player, snapshot } = await api.register(username.trim(), password);
        onAuthenticated(player, snapshot);
      } else {
        onAuthenticated((await api.login(username.trim(), password)).player);
      }
    } catch (err) {
      if (err instanceof ApiError && err.body?.fields) {
        setFields(err.body.fields);
      } else if (err instanceof ApiError) {
        setBanner(bannerMessage(err.body?.error) ?? 'Something went wrong. Try again.');
      } else {
        setBanner('Network error. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const usernameErr = usernameMessage(fields.username);
  const passwordErr = passwordMessage(fields.password);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form onSubmit={submit} noValidate style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo size={34} />
          <div>
            <div className="disp" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '.04em' }}>
              {register ? 'Join the Universe' : 'Return to command'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
              Universe Speed x{universeSpeed}
            </div>
          </div>
        </div>

        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-pressed={!register}
            onClick={() => setMode('login')}
          >
            LOG IN
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={register}
            onClick={() => setMode('register')}
          >
            REGISTER
          </button>
        </div>

        {banner && (
          <div className="banner" role="alert">
            <span aria-hidden="true">⚠</span> <span>{banner}</span>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className={`input${usernameErr ? ' bad' : ''}`}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameErr ? (
            <div className="err">{usernameErr}</div>
          ) : register ? (
            <div style={hintStyle}>3–20 letters, digits, _ or -. Can’t be changed later.</div>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={show ? 'text' : 'password'}
              className={`input${passwordErr ? ' bad' : ''}`}
              autoComplete={register ? 'new-password' : 'current-password'}
              style={{ paddingRight: 64 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="show-toggle" onClick={() => setShow((s) => !s)}>
              {show ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          {passwordErr ? (
            <div className="err">{passwordErr}</div>
          ) : register ? (
            <div style={hintStyle}>At least 8 characters.</div>
          ) : null}
        </div>

        <button className="btn fill" type="submit" disabled={submitting}>
          {register ? 'Create Player' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

const cardStyle = {
  width: 440,
  boxSizing: 'border-box' as const,
  padding: 36,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 22,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-panel)',
  boxShadow: '0 30px 80px rgba(0,0,0,.5)',
};

const hintStyle = { fontSize: 12, color: 'var(--text-muted)' };
