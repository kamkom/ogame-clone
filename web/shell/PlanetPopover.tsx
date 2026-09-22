import { useEffect, useRef, useState, type FormEvent } from 'react';
import { validatePlanetName } from '#shared/planetName.ts';
import { ApiError, type PlanetSnapshot } from '../lib/api.ts';
import { planetNameMessage } from './planetName.ts';

interface PlanetPopoverProps {
  planet: PlanetSnapshot;
  onRename: (name: string) => Promise<PlanetSnapshot>;
  onClose: () => void;
}

/**
 * The planet popover (spec #22, UI states pick B): opened from the top-bar picker. Shows the
 * Planet's name, Coordinates, Fields and diameter, a RENAME PLANET field (Enter saves), and the
 * footer. Esc or a click outside closes it; an invalid name shows an inline error.
 */
export function PlanetPopover({ planet, onRename, onClose }: PlanetPopoverProps) {
  const [name, setName] = useState(planet.name);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const result = validatePlanetName(name);
    if (result.error) {
      setError(planetNameMessage(result.error));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onRename(result.name);
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.body?.code : undefined;
      setError(planetNameMessage(code as never) ?? 'Couldn’t save that name. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} style={popoverStyle} role="dialog" aria-label="Planet">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          className="disp"
          style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {planet.name}
        </div>
        <div className="coords" style={{ fontSize: 13 }}>
          {planet.coordinatesLabel}
        </div>
      </div>

      <div style={statsStyle}>
        <div className="label">Fields</div>
        <div className="disp" style={valueStyle}>
          {planet.fields.used} / {planet.fields.max}
        </div>
        <div className="label">Diameter</div>
        <div className="disp" style={valueStyle}>
          {planet.diameterKm.toLocaleString('en-US')} km
        </div>
      </div>

      <form onSubmit={save} noValidate className="field">
        <label className="label" htmlFor="rename-planet">
          Rename planet
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="rename-planet"
            className={`input${error ? ' bad' : ''}`}
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
          />
          <button
            className="btn fill"
            type="submit"
            disabled={saving}
            style={{ padding: '0 18px' }}
          >
            Save
          </button>
        </div>
        {error && <div className="err">{error}</div>}
      </form>

      <div style={footerStyle}>1 of 1 Planets · Colonies SOON</div>
    </div>
  );
}

const popoverStyle = {
  position: 'absolute' as const,
  top: 'calc(100% + 8px)',
  left: 0,
  width: 320,
  boxSizing: 'border-box' as const,
  padding: 20,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-panel)',
  boxShadow: '0 20px 60px rgba(0,0,0,.5)',
  zIndex: 20,
};

const statsStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 16,
  rowGap: 6,
  alignItems: 'baseline',
};

const valueStyle = { fontSize: 14, textAlign: 'right' as const };

const footerStyle = {
  fontSize: 12,
  color: 'var(--text-muted)',
  borderTop: '1px solid var(--line)',
  paddingTop: 12,
};
