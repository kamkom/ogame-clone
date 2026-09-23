import type { ReactNode } from 'react';
import type { BuildSlotView, PlanetSnapshot } from '../lib/api.ts';
import { formatCostCompact } from '../lib/affordability.ts';
import {
  type DeckStructureRow,
  deckStructureRows,
  dockSubtitle,
  fleetDock,
  slotProgress,
  slotRows,
} from '../lib/commandDeck.ts';
import { formatCountdown } from '../lib/duration.ts';
import { useServerNow } from '../lib/useServerNow.ts';
import { catalogName } from '#shared/catalog.ts';
import { ArtIcon } from './art.tsx';
import { ShipSilhouette } from './shipArt.tsx';
import { CancelX, ClockIcon, LockIcon } from './stateControls.tsx';

interface CommandDeckProps {
  planet: PlanetSnapshot;
  universeSpeed: number;
  onUpgrade: (key: string) => void;
  onCancel: (slot: number) => void;
  onManage: () => void;
  pendingKey: string | null;
}

/**
 * The Command Deck (Overview): the Planet with its real callouts, the Construction Queue, all 13
 * Structures and the Fleet Dock (spec stories 79–82). The Moon, Defense Grid and DISPATCH are
 * SOON placeholders (#14 pick B).
 */
export function CommandDeck({
  planet,
  universeSpeed,
  onUpgrade,
  onCancel,
  onManage,
  pendingKey,
}: CommandDeckProps) {
  const now = useServerNow(planet.serverNow);
  const rows = deckStructureRows(planet, universeSpeed, now);
  const hasShipyard = (planet.structures['orbital-shipyard'] ?? 0) > 0;
  const { used, max } = planet.fields;

  return (
    <div style={contentStyle}>
      <PlanetStage />

      {/* left callouts */}
      <Callout x={32} y={118} label="SURFACE">
        <span style={calloutValueStyle}>
          {used} <span style={{ color: 'var(--text-muted)' }}>/ {max}</span>
        </span>
        <div style={{ width: 140, height: 3, background: 'var(--line)' }}>
          <div
            style={{
              width: `${Math.min(100, (used / max) * 100)}%`,
              height: 3,
              background: 'var(--text)',
            }}
          />
        </div>
      </Callout>
      <Callout x={32} y={228} label="TEMPERATURE">
        <span style={calloutValueStyle}>
          {formatTemp(planet.temperature.min)}° / {formatTemp(planet.temperature.max)}°C
        </span>
      </Callout>
      <Callout x={32} y={320} label="DIAMETER">
        <span style={calloutValueStyle}>{planet.diameterKm.toLocaleString('en-US')} km</span>
      </Callout>

      {/* right callouts: placeholders until moons and defenses exist */}
      <Callout x={748} y={118} label="MOON" soon>
        <span style={{ ...calloutValueStyle, color: 'var(--text-muted)' }}>No moon</span>
        <span style={calloutNoteStyle}>Moons form from battle debris</span>
      </Callout>
      <Callout x={748} y={320} label="DEFENSE GRID" soon>
        <span style={{ ...calloutValueStyle, color: 'var(--text-muted)' }}>No defenses</span>
        <span style={calloutNoteStyle}>Defenses aren&rsquo;t buildable yet</span>
      </Callout>

      {/* name and Coordinates under the planet */}
      <div style={planetNameStyle}>
        <span className="disp" style={{ fontSize: 20, fontWeight: 600 }}>
          {planet.name}
        </span>
        <span className="coords" style={{ fontSize: 13 }}>
          {planet.coordinatesLabel}
        </span>
      </div>

      <aside style={asideStyle}>
        <ConstructionQueue planet={planet} now={now} onCancel={onCancel} />
        <StructuresPanel
          rows={rows}
          pendingKey={pendingKey}
          onUpgrade={onUpgrade}
          onManage={onManage}
        />
      </aside>

      <FleetDock ships={planet.ships} hasShipyard={hasShipyard} />
    </div>
  );
}

/** "−12" with a real minus sign, as the design writes it. */
function formatTemp(t: number): string {
  return t < 0 ? `−${-t}` : String(t);
}

function Callout({
  x,
  y,
  label,
  soon,
  children,
}: {
  x: number;
  y: number;
  label: string;
  soon?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ ...calloutStyle, left: x, top: y }}>
      <span style={{ ...kickerStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
        {soon && <SoonChip />}
      </span>
      {children}
    </div>
  );
}

function SoonChip() {
  return (
    <span style={soonChipStyle} aria-label="Coming soon">
      <LockIcon size={9} />
      SOON
    </span>
  );
}

function PlanetStage() {
  return (
    <>
      <div style={planetStyle} aria-hidden="true" />
      <svg
        width="560"
        height="560"
        viewBox="0 0 560 560"
        style={{ position: 'absolute', left: 192, top: -10 }}
        aria-hidden="true"
      >
        <circle cx="280" cy="280" r="200" fill="none" stroke="var(--accent)" strokeOpacity="0.35" />
        <ellipse
          cx="280"
          cy="280"
          rx="200"
          ry="60"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.14"
        />
        <ellipse
          cx="280"
          cy="280"
          rx="200"
          ry="130"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.1"
        />
        <ellipse
          cx="280"
          cy="280"
          rx="70"
          ry="200"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.12"
        />
        <ellipse
          cx="280"
          cy="280"
          rx="140"
          ry="200"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.08"
        />
        <circle
          cx="280"
          cy="280"
          r="252"
          fill="none"
          stroke="var(--hud-ring)"
          strokeDasharray="1 7"
        />
        <path
          d="M40 60 V30 H70 M520 60 V30 H490 M40 500 V530 H70 M520 500 V530 H490"
          fill="none"
          stroke="var(--hud-corner)"
          strokeWidth="1.5"
        />
      </svg>
    </>
  );
}

/** Both Build Slots: a busy slot with its countdown, ✕ and refund line, or a dashed free row. */
function ConstructionQueue({
  planet,
  now,
  onCancel,
}: {
  planet: PlanetSnapshot;
  now: number;
  onCancel: (slot: number) => void;
}) {
  const slots = slotRows(planet);
  const busyCount = slots.filter((s) => s.busy !== null).length;
  return (
    <div
      style={{
        ...queueBoxStyle,
        borderColor: busyCount > 0 ? 'var(--accent-line)' : 'var(--line)',
      }}
    >
      <div style={{ ...kickerStyle, display: 'flex', justifyContent: 'space-between' }}>
        <span>CONSTRUCTION QUEUE</span>
        <span style={{ color: busyCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
          {busyCount} / {slots.length}
        </span>
      </div>
      {slots.map(({ slot, busy }) =>
        busy ? (
          <BusySlot key={slot} slot={busy} now={now} onCancel={() => onCancel(slot)} />
        ) : (
          <div key={slot} style={freeSlotStyle}>
            SLOT {slot} · Free
          </div>
        ),
      )}
    </div>
  );
}

function BusySlot({
  slot,
  now,
  onCancel,
}: {
  slot: BuildSlotView;
  now: number;
  onCancel: () => void;
}) {
  const name = catalogName(slot.structure);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flexGrow: 1, fontSize: 16, fontWeight: 600 }}>
          {name} → {slot.targetLevel}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--accent)' }}>
          {formatCountdown(slot.endsAt - now)}
        </span>
        <CancelX label={name} onClick={onCancel} />
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--line)' }}>
        <div
          style={{
            width: `${slotProgress(slot, now) * 100}%`,
            height: 4,
            borderRadius: 4,
            background: 'var(--accent)',
          }}
        />
      </div>
      <div style={refundLineStyle}>
        <span>Cancel refunds {formatCostCompact(slot.cost)}</span>
        <span>Field returned</span>
      </div>
    </div>
  );
}

/** All 13 Structures, scrolling inside the panel; each button upgrades or shows why it can't. */
function StructuresPanel({
  rows,
  pendingKey,
  onUpgrade,
  onManage,
}: {
  rows: DeckStructureRow[];
  pendingKey: string | null;
  onUpgrade: (key: string) => void;
  onManage: () => void;
}) {
  return (
    <div style={structuresPanelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={sectionTitleStyle}>STRUCTURES</h2>
        <button type="button" onClick={onManage} style={linkButtonStyle}>
          Manage
        </button>
      </div>
      <div className="scroll" style={{ overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
        {rows.map((r) => (
          <StructureRow
            key={r.def.key}
            row={r}
            pending={pendingKey === r.def.key}
            onUpgrade={() => onUpgrade(r.def.key)}
          />
        ))}
      </div>
    </div>
  );
}

function StructureRow({
  row,
  pending,
  onUpgrade,
}: {
  row: DeckStructureRow;
  pending: boolean;
  onUpgrade: () => void;
}) {
  const { def, level, slot, action } = row;
  const tone = slot ? 'var(--accent)' : 'var(--text)';
  const verb = level === 0 ? 'Build' : 'Upgrade';
  return (
    <div style={structureRowStyle}>
      <ArtIcon art={def.art} size={22} color="var(--text-body)" />
      <span style={structureNameStyle}>{def.name}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: tone }}>
          {level}
        </span>
        {level === 0 && <span style={notBuiltStyle}>NOT BUILT</span>}
      </span>
      {action.enabled ? (
        <button
          type="button"
          disabled={pending}
          aria-label={`${verb} ${def.name}`}
          title={`${verb} to level ${level + 1}`}
          onClick={onUpgrade}
          style={listButtonStyle(true)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-label={`${def.name}: ${row.reason}`}
          title={row.reason}
          style={listButtonStyle(false)}
        >
          {action.icon === 'clock' ? <ClockIcon size={11} /> : <LockIcon size={11} />}
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Docked ships (Solar Satellites left out), or one dashed row with no Orbital Shipyard. */
function FleetDock({
  ships,
  hasShipyard,
}: {
  ships: Record<string, number>;
  hasShipyard: boolean;
}) {
  const { tiles, docked } = fleetDock(ships);
  return (
    <section style={dockStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h2 style={sectionTitleStyle}>FLEET DOCK</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dockSubtitle(docked)}</span>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Fleet Dispatch — SOON"
          style={dispatchStyle}
        >
          <LockIcon />
          DISPATCH <span style={soonChipStyle}>SOON</span>
        </button>
      </div>
      {hasShipyard ? (
        <div style={dockGridStyle}>
          {tiles.map((t) => (
            <div key={t.def.key} style={dockTileStyle}>
              <ShipSilhouette def={t.def} width={60} height={30} dim={t.count === 0} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>
                {t.count.toLocaleString('en-US')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.def.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={dockEmptyStyle}>Ships need an Orbital Shipyard</div>
      )}
    </section>
  );
}

// Positions are the design's stage coordinates, offset by the rail (88) and top bar (72).
const contentStyle = {
  position: 'absolute' as const,
  left: 'var(--rail-w)',
  right: 0,
  top: 'var(--topbar-h)',
  bottom: 0,
};

const planetStyle = {
  position: 'absolute' as const,
  left: 272,
  top: 70,
  width: 400,
  height: 400,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 78% 76%, rgba(4,7,12,0.96), rgba(4,7,12,0) 64%), radial-gradient(ellipse 40% 10% at 45% 40%, rgba(255,255,255,0.25), rgba(255,255,255,0) 70%), radial-gradient(circle at 34% 30%, #f1f6ff 0%, var(--planet) 32%, #54708e 60%, #1a2736 92%)',
  boxShadow: '0 0 80px rgba(150,190,230,0.18)',
};

const planetNameStyle = {
  position: 'absolute' as const,
  left: 272,
  top: 534,
  width: 400,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 2,
};

const calloutStyle = {
  position: 'absolute' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  fontFamily: 'var(--font-display)',
};

const kickerStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
};

const calloutValueStyle = { fontSize: 20 };

const calloutNoteStyle = { fontSize: 13, color: 'var(--text-muted)' };

const soonChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontFamily: 'var(--font-display)',
  fontSize: 9,
  letterSpacing: '.08em',
  color: 'var(--text-muted)',
  border: '1px solid var(--line-strong)',
  borderRadius: 3,
  padding: '0 3px',
};

const asideStyle = {
  position: 'absolute' as const,
  right: 24,
  top: 24,
  bottom: 24,
  width: 'var(--aside-w)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
};

const queueBoxStyle = {
  boxSizing: 'border-box' as const,
  padding: 16,
  borderRadius: 12,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
  flexShrink: 0,
};

const freeSlotStyle = {
  height: 38,
  boxSizing: 'border-box' as const,
  borderRadius: 8,
  border: '1px dashed var(--line-strong)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
};

const refundLineStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const structuresPanelStyle = {
  flexGrow: 1,
  minHeight: 0,
  boxSizing: 'border-box' as const,
  padding: '6px 16px 8px',
  borderRadius: 12,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
};

const sectionTitleStyle = {
  margin: 0,
  lineHeight: '44px',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '0.08em',
};

const linkButtonStyle = {
  padding: 0,
  border: 0,
  background: 'none',
  color: 'var(--accent)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  cursor: 'pointer',
};

const structureRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  height: 50,
  borderTop: '1px solid var(--line-soft)',
};

const structureNameStyle = {
  flexGrow: 1,
  minWidth: 0,
  fontSize: 15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const notBuiltStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 8.5,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
};

function listButtonStyle(enabled: boolean) {
  return {
    minWidth: 44,
    height: 36,
    flexShrink: 0,
    boxSizing: 'border-box' as const,
    padding: enabled ? 0 : '0 8px',
    borderRadius: 8,
    border: '1px solid var(--line-control)',
    background: enabled ? 'transparent' : 'var(--icon-well)',
    color: enabled ? 'var(--text)' : 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    whiteSpace: 'nowrap' as const,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.04em',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const dockStyle = {
  position: 'absolute' as const,
  left: 24,
  right: 388,
  bottom: 24,
  boxSizing: 'border-box' as const,
  padding: '16px 18px',
  borderRadius: 14,
  background: 'var(--dock)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
};

const dispatchStyle = {
  height: 40,
  padding: '0 18px',
  borderRadius: 8,
  border: '1px solid var(--line-strong)',
  background: 'var(--icon-well)',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '0.08em',
  cursor: 'not-allowed',
};

const dockGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
  gap: 8,
};

const dockTileStyle = {
  boxSizing: 'border-box' as const,
  padding: '10px 8px',
  borderRadius: 10,
  background: 'var(--panel-raised)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 6,
};

const dockEmptyStyle = {
  height: 56,
  boxSizing: 'border-box' as const,
  borderRadius: 10,
  border: '1px dashed var(--line-strong)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: 'var(--text-muted)',
};
