import { useMemo, useState } from 'react';
import { SHIPS, shipDef } from '#shared/catalog.ts';
import { orderCost, unlockText } from '#shared/shipyard.ts';
import type { PlanetSnapshot, ShipyardOrderView } from '../lib/api.ts';
import { formatCompact } from '../lib/affordability.ts';
import { formatCountdown, formatDuration } from '../lib/duration.ts';
import { type LiveResources, liveResources } from '../lib/liveResources.ts';
import {
  averageTemperature,
  clampQuantity,
  fleetStrength,
  orderAction,
  orderProgress,
  ordersLabel,
  satelliteEnergyEach,
  shipView,
  type ShipView,
  waitingOrderSec,
} from '../lib/shipyard.ts';
import { useServerNow } from '../lib/useServerNow.ts';
import { RESOURCES } from './icons.tsx';
import { ShipBlueprint, ShipSilhouette } from './shipArt.tsx';
import { LockIcon } from './stateControls.tsx';

interface ShipyardProps {
  planet: PlanetSnapshot;
  universeSpeed: number;
  onOrder: (ship: string, quantity: number) => void;
  pendingKey: string | null;
  onGoToStructures: () => void;
}

/**
 * The Shipyard screen: the ship list, the selected ship's blueprint, stats and order box, and the
 * Production Queue with Fleet Strength. With no Orbital Shipyard it shows a blocking panel instead
 * (spec stories 66–76).
 */
export function Shipyard({
  planet,
  universeSpeed,
  onOrder,
  pendingKey,
  onGoToStructures,
}: ShipyardProps) {
  const now = useServerNow(planet.serverNow);
  const live = liveResources(planet, now);
  const [selectedKey, setSelectedKey] = useState<string>('cruiser');
  // The field's raw text, so it can be cleared while typing; the Order uses the clamped value.
  const [quantityText, setQuantityText] = useState('1');
  const quantity = clampQuantity(quantityText);

  const views = useMemo(
    () =>
      new Map<string, ShipView>(
        SHIPS.map((def) => [def.key, shipView(def, planet, universeSpeed, live)]),
      ),
    [planet, universeSpeed, live],
  );
  const selected = views.get(selectedKey) ?? views.get(SHIPS[0]!.key)!;
  const shipyard = planet.structures['orbital-shipyard'] ?? 0;

  if (shipyard === 0) {
    return (
      <div style={contentStyle}>
        <div style={{ position: 'absolute', left: 24, top: 24 }}>
          <Heading level={shipyard} />
        </div>
        <div style={blockingStyle}>
          <ShipSilhouette def={shipDef('cruiser')!} width={128} height={64} dim />
          <h2 style={blockingTitleStyle}>No Orbital Shipyard yet</h2>
          <p style={blockingTextStyle}>
            Build an Orbital Shipyard on the Structures screen to start building ships.
          </p>
          <button type="button" onClick={onGoToStructures} style={primaryButtonStyle(true)}>
            GO TO STRUCTURES
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={contentStyle}>
      <section style={listColumnStyle}>
        <Heading level={shipyard} />
        <div style={tabsStyle}>
          <button type="button" aria-pressed="true" style={tabStyle(true)}>
            Ships
          </button>
          <button
            type="button"
            aria-pressed="false"
            aria-disabled="true"
            disabled
            title="Defenses — SOON"
            style={{ ...tabStyle(false), cursor: 'not-allowed', opacity: 0.6 }}
          >
            <LockIcon />
            Defenses <span style={soonChipStyle}>SOON</span>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHIPS.map((def) => (
            <ShipRow
              key={def.key}
              view={views.get(def.key)!}
              selected={def.key === selected.def.key}
              onSelect={() => setSelectedKey(def.key)}
            />
          ))}
        </div>
      </section>

      <DetailPanel
        view={selected}
        planet={planet}
        live={live}
        quantity={quantity}
        quantityText={quantityText}
        onQuantityText={setQuantityText}
        pending={pendingKey === selected.def.key}
        onOrder={() => onOrder(selected.def.key, quantity)}
      />

      <aside style={asideStyle}>
        <ProductionQueue planet={planet} now={now} universeSpeed={universeSpeed} />
        <FleetStrengthPanel ships={planet.ships} />
      </aside>
    </div>
  );
}

function Heading({ level }: { level: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h1 style={titleStyle}>Shipyard</h1>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        Orbital Shipyard level {level}
      </span>
    </div>
  );
}

function ShipRow({
  view,
  selected,
  onSelect,
}: {
  view: ShipView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        ...rowStyle,
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
        background: selected ? 'var(--accent-select)' : 'var(--panel)',
      }}
    >
      <ShipSilhouette def={view.def} />
      <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{view.def.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{view.def.role}</span>
      </span>
      {view.unlocked ? (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
          {view.count.toLocaleString('en-US')}
        </span>
      ) : (
        <span style={lockedChipStyle}>LOCKED</span>
      )}
    </button>
  );
}

function DetailPanel({
  view,
  planet,
  live,
  quantity,
  quantityText,
  onQuantityText,
  pending,
  onOrder,
}: {
  view: ShipView;
  planet: PlanetSnapshot;
  live: LiveResources;
  quantity: number;
  quantityText: string;
  onQuantityText: (text: string) => void;
  pending: boolean;
  onOrder: () => void;
}) {
  const { def } = view;
  const setQuantity = (n: number) => onQuantityText(String(clampQuantity(String(n))));
  const action = orderAction(planet, view, quantity);
  const enabled = action.enabled && !pending;
  const cost = orderCost(def, quantity);
  const energyEach = satelliteEnergyEach(planet);
  const stats =
    def.shipClass === 'energy'
      ? [
          { n: 'ENERGY / SATELLITE', v: `+${energyEach}` },
          { n: 'AVG TEMPERATURE', v: `${averageTemperature(planet)}°C` },
          { n: 'FROM DOCKED', v: `+${(energyEach * view.count).toLocaleString('en-US')}` },
        ]
      : [
          { n: 'ATTACK', v: def.stats.attack },
          { n: 'SHIELDS', v: def.stats.shields },
          { n: 'HULL', v: def.stats.hull },
          { n: 'SPEED', v: def.stats.speed },
          { n: 'CARGO', v: def.stats.cargo },
          { n: 'FUEL / JUMP', v: def.stats.fuel },
        ].map((s) => ({ n: s.n, v: s.v.toLocaleString('en-US') }));
  const costParts = (['alloy', 'crystal', 'deuterium'] as const)
    .map((r, i) => ({ r, meta: RESOURCES[i]!, value: cost[r] }))
    .filter((c) => c.value > 0);

  return (
    <section style={detailStyle}>
      <div style={blueprintStyle}>
        <ShipBlueprint def={def} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={kickerStyle}>
            {def.role.toUpperCase()} · {view.count.toLocaleString('en-US')} IN ORBIT
          </span>
          <h2 style={detailTitleStyle}>{def.name}</h2>
        </div>
        <span style={{ fontSize: 13, color: view.unlocked ? 'var(--text-body)' : 'var(--danger)' }}>
          {view.unlocked ? 'Unlocked' : 'Unlocks at'} · {unlockText(def.requires)}
        </span>
      </div>
      <div style={statsGridStyle}>
        {stats.map((t) => (
          <div key={t.n} style={statCardStyle}>
            <span style={kickerStyle}>{t.n}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{t.v}</span>
          </div>
        ))}
      </div>
      <div style={orderBoxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label htmlFor="qty" style={kickerStyle}>
            QUANTITY
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              aria-label="Fewer"
              disabled={quantity <= 1}
              onClick={() => setQuantity(quantity - 1)}
              style={stepperStyle(quantity > 1)}
            >
              −
            </button>
            <input
              id="qty"
              inputMode="numeric"
              value={quantityText}
              onChange={(e) => onQuantityText(e.target.value.replace(/\D/g, '').slice(0, 5))}
              onBlur={() => setQuantity(quantity)}
              style={qtyInputStyle}
            />
            <button
              type="button"
              aria-label="More"
              onClick={() => setQuantity(quantity + 1)}
              style={stepperStyle(true)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => setQuantity(view.maxN)}
            style={{
              ...linkButtonStyle,
              color: view.maxN > 0 ? 'var(--accent)' : 'var(--danger)',
            }}
          >
            Max {view.maxN.toLocaleString('en-US')}
          </button>
          <span style={durationStyle} title={`${formatDuration(view.unitSec)} per unit`}>
            {formatDuration(view.unitSec * quantity)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={costRowStyle}>
            {costParts.map(({ r, meta, value }) => (
              <span
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: value > Math.floor(live[r]) ? 'var(--danger)' : undefined,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={`var(${meta.cssVar})`}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  aria-label={meta.name}
                >
                  <path d={meta.path} />
                </svg>
                {formatCompact(value)}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={!enabled}
            onClick={onOrder}
            style={primaryButtonStyle(enabled)}
          >
            {pending ? 'ORDERING…' : action.label}
          </button>
        </div>
      </div>
    </section>
  );
}

function ProductionQueue({
  planet,
  now,
  universeSpeed,
}: {
  planet: PlanetSnapshot;
  now: number;
  universeSpeed: number;
}) {
  const orders = planet.shipyardOrders;
  return (
    <div style={{ ...panelStyle, gap: 14 }}>
      <div style={panelHeaderStyle}>
        <span style={{ color: 'var(--text-muted)' }}>PRODUCTION QUEUE</span>
        <span style={{ color: 'var(--accent)' }}>{ordersLabel(orders.length)}</span>
      </div>
      {orders.length === 0 ? (
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          No Orders · ships roll out here unit by unit
        </span>
      ) : (
        <div style={queueListStyle} role="list" aria-label="Production Queue">
          {orders.map((o, i) => (
            <OrderRow
              key={o.id}
              order={o}
              first={i === 0}
              now={now}
              waitingSec={waitingOrderSec(o, planet, universeSpeed)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  first,
  now,
  waitingSec,
}: {
  order: ShipyardOrderView;
  first: boolean;
  now: number;
  waitingSec: number;
}) {
  const def = shipDef(order.ship);
  const running = order.startedAt !== null;
  const progress = orderProgress(order, now);
  const rowBase = {
    ...queueRowStyle,
    ...(first ? {} : { paddingTop: 14, borderTop: '1px solid var(--line)' }),
  };
  if (!running) {
    return (
      <div role="listitem" style={rowBase}>
        {def && <ShipSilhouette def={def} width={56} height={28} dim />}
        <div style={waitingRowTextStyle}>
          <span>
            {def?.name ?? order.ship} · {order.quantity.toLocaleString('en-US')}
          </span>
          <span style={{ fontFamily: 'var(--font-display)' }}>
            queued · {formatDuration(waitingSec)}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div role="listitem" style={rowBase}>
      {def && <ShipSilhouette def={def} width={56} height={28} />}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>
            {def?.name ?? order.ship} · {progress.completed.toLocaleString('en-US')} of{' '}
            {order.quantity.toLocaleString('en-US')}
          </span>
          <span
            style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            title={
              progress.nextUnitInMs !== null
                ? `Next unit in ${formatCountdown(progress.nextUnitInMs)}`
                : undefined
            }
          >
            {order.endsAt !== null ? formatCountdown(order.endsAt - now) : '—'}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: 'var(--line)' }}>
          <div
            style={{
              width: `${Math.round(progress.fraction * 100)}%`,
              height: 4,
              borderRadius: 4,
              background: 'var(--accent)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

const STRENGTH_COLORS = {
  combat: 'var(--crystal)',
  cargo: 'var(--alloy)',
  support: 'var(--accent)',
};

function FleetStrengthPanel({ ships }: { ships: Record<string, number> }) {
  const strength = fleetStrength(ships);
  const parts = [
    { key: 'combat', label: 'Combat', value: strength.combat },
    { key: 'cargo', label: 'Cargo', value: strength.cargo },
    { key: 'support', label: 'Support', value: strength.support },
  ] as const;
  return (
    <div style={{ ...panelStyle, gap: 12 }}>
      <span style={kickerStyle}>FLEET STRENGTH</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 30 }}>
          {strength.total.toLocaleString('en-US')}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ships docked</span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          gap: 2,
          background: strength.total === 0 ? 'var(--line)' : undefined,
        }}
      >
        {strength.total > 0 &&
          parts.map((p) => (
            <div
              key={p.key}
              style={{
                width: `${(p.value / strength.total) * 100}%`,
                background: STRENGTH_COLORS[p.key],
              }}
            />
          ))}
      </div>
      <div style={strengthListStyle}>
        {parts.map((p) => (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{ width: 8, height: 8, borderRadius: 2, background: STRENGTH_COLORS[p.key] }}
              />
              {p.label}
            </span>
            <span style={{ fontFamily: 'var(--font-display)' }}>
              {p.value.toLocaleString('en-US')}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Fleet Dispatch — SOON"
        style={dispatchStyle}
      >
        <LockIcon />
        OPEN FLEET DISPATCH <span style={soonChipStyle}>SOON</span>
      </button>
    </div>
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

const listColumnStyle = {
  position: 'absolute' as const,
  left: 24,
  top: 24,
  width: 300,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
};

const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 28,
};

const tabsStyle = {
  display: 'flex',
  gap: 6,
  padding: 4,
  borderRadius: 10,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
};

function tabStyle(active: boolean) {
  return {
    flexGrow: 1,
    height: 36,
    borderRadius: 7,
    border: 0,
    background: active ? 'var(--line)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };
}

const soonChipStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 9,
  letterSpacing: '.08em',
  color: 'var(--text-muted)',
  border: '1px solid var(--line-strong)',
  borderRadius: 3,
  padding: '0 3px',
};

// 66 px rows (the design's 70 px) so all 9 ships fit without scrolling (spec story 66).
const rowStyle = {
  height: 66,
  boxSizing: 'border-box' as const,
  padding: '0 14px',
  borderRadius: 10,
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  cursor: 'pointer',
  textAlign: 'left' as const,
  fontFamily: 'var(--font-body)',
};

const lockedChipStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 10,
  letterSpacing: '.1em',
  color: 'var(--text-muted)',
  border: '1px dashed var(--line-strong)',
  borderRadius: 4,
  padding: '2px 6px',
};

const detailStyle = {
  position: 'absolute' as const,
  left: 348,
  top: 24,
  width: 616,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
};

const blueprintStyle = {
  height: 236,
  boxSizing: 'border-box' as const,
  borderRadius: 12,
  border: '1px solid var(--line-icon)',
  backgroundColor: 'var(--panel)',
  backgroundImage:
    'linear-gradient(rgba(95,227,192,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(95,227,192,0.05) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const kickerStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
};

const detailTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 26,
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
};

const statCardStyle = {
  padding: '10px 14px',
  borderRadius: 10,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

const orderBoxStyle = {
  boxSizing: 'border-box' as const,
  padding: 16,
  borderRadius: 12,
  background: 'var(--panel)',
  border: '1px solid var(--accent-line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
};

function stepperStyle(enabled: boolean) {
  return {
    width: 44,
    height: 44,
    borderRadius: 8,
    border: '1px solid var(--line-strong)',
    background: 'transparent',
    color: enabled ? 'var(--text)' : 'var(--text-muted)',
    fontSize: 20,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const qtyInputStyle = {
  width: 72,
  height: 44,
  boxSizing: 'border-box' as const,
  borderRadius: 8,
  border: '1px solid var(--line-strong)',
  background: 'var(--bg)',
  color: 'var(--text)',
  textAlign: 'center' as const,
  fontFamily: 'var(--font-display)',
  fontSize: 18,
};

const linkButtonStyle = {
  background: 'none',
  border: 0,
  padding: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  cursor: 'pointer',
};

const durationStyle = {
  marginLeft: 'auto',
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  color: 'var(--text-body)',
};

const costRowStyle = {
  flexGrow: 1,
  display: 'flex',
  gap: 18,
  fontFamily: 'var(--font-display)',
  fontSize: 15,
};

function primaryButtonStyle(enabled: boolean) {
  return {
    height: 48,
    padding: '0 22px',
    borderRadius: 10,
    border: 0,
    background: enabled ? 'var(--accent)' : 'var(--line)',
    color: enabled ? 'var(--on-accent)' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '0.08em',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const asideStyle = {
  position: 'absolute' as const,
  right: 24,
  top: 24,
  width: 340,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
};

const panelStyle = {
  boxSizing: 'border-box' as const,
  padding: 16,
  borderRadius: 12,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
};

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '0.12em',
};

// Four rows show; the rest scroll (spec story 71). Each row is 28 px of art plus 14 px of spacing.
const QUEUE_ROW_H = 42;
const queueListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
  maxHeight: 4 * QUEUE_ROW_H + 3 * 14,
  overflowY: 'auto' as const,
};

const queueRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
};

const waitingRowTextStyle = {
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  color: 'var(--text-body)',
};

const strengthListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  fontSize: 13,
  color: 'var(--text-body)',
};

const dispatchStyle = {
  height: 44,
  marginTop: 4,
  borderRadius: 8,
  border: '1px solid var(--line-strong)',
  background: 'transparent',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  letterSpacing: '0.08em',
  cursor: 'not-allowed',
};

const blockingStyle = {
  position: 'absolute' as const,
  left: 24,
  right: 24,
  top: 124,
  bottom: 24,
  borderRadius: 12,
  border: '1px dashed var(--line-strong)',
  background: 'var(--panel)',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
};

const blockingTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 22,
};

const blockingTextStyle = {
  margin: 0,
  fontSize: 14,
  color: 'var(--text-body)',
};
