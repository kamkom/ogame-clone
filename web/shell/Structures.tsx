import { useMemo, useState } from 'react';
import { STRUCTURES, type StructureDef, type StructureTab } from '#shared/catalog.ts';
import { levelCost, structureDurationSec } from '#shared/economy.ts';
import type { BuildSlotView, PlanetSnapshot } from '../lib/api.ts';
import { formatResource } from '../lib/format.ts';
import { formatCountdown, formatDuration } from '../lib/duration.ts';
import { liveResources } from '../lib/liveResources.ts';
import { useServerNow } from '../lib/useServerNow.ts';

interface StructuresProps {
  planet: PlanetSnapshot;
  universeSpeed: number;
  onUpgrade: (key: string) => void;
  pendingKey: string | null;
}

type TabKey = 'all' | StructureTab;

const TABS: { key: TabKey; label: string; count: (d: StructureDef) => boolean }[] = [
  { key: 'all', label: 'All', count: () => true },
  { key: 'resources', label: 'Resources', count: (d) => d.tab === 'resources' },
  { key: 'facilities', label: 'Facilities', count: (d) => d.tab === 'facilities' },
  { key: 'storage', label: 'Storage', count: (d) => d.tab === 'storage' },
];

interface StructureView {
  def: StructureDef;
  level: number;
  targetLevel: number;
  cost: { alloy: number; crystal: number; deuterium: number };
  durationSec: number;
  slot: BuildSlotView | null;
  affordable: boolean;
}

function viewFor(
  def: StructureDef,
  planet: PlanetSnapshot,
  speed: number,
  live: { alloy: number; crystal: number; deuterium: number },
): StructureView {
  const level = planet.structures[def.key] ?? 0;
  const targetLevel = level + 1;
  const cost = {
    alloy: levelCost(def.baseCost.alloy, def.factor, targetLevel),
    crystal: levelCost(def.baseCost.crystal, def.factor, targetLevel),
    deuterium: levelCost(def.baseCost.deuterium, def.factor, targetLevel),
  };
  const robotics = planet.structures['robotics-works'] ?? 0;
  const nanite = planet.structures['nanite-foundry'] ?? 0;
  const durationSec = structureDurationSec(
    cost.alloy,
    cost.crystal,
    targetLevel,
    robotics,
    nanite,
    speed,
    def.isNaniteFoundry ?? false,
  );
  const slot = planet.buildSlots.find((s) => s?.structure === def.key) ?? null;
  const affordable =
    Math.floor(live.alloy) >= cost.alloy &&
    Math.floor(live.crystal) >= cost.crystal &&
    Math.floor(live.deuterium) >= cost.deuterium;
  return { def, level, targetLevel, cost, durationSec, slot, affordable };
}

/** The Structures screen: filter tabs, a scrolling 3-column card grid, and a detail panel. */
export function Structures({ planet, universeSpeed, onUpgrade, pendingKey }: StructuresProps) {
  const now = useServerNow(planet.serverNow);
  const live = liveResources(planet, now);
  const [tab, setTab] = useState<TabKey>('all');
  const [selectedKey, setSelectedKey] = useState<string>(STRUCTURES[0]!.key);

  const views = useMemo(
    () => STRUCTURES.map((def) => viewFor(def, planet, universeSpeed, live)),
    [planet, universeSpeed, live],
  );
  const shown = views.filter((v) => TABS.find((t) => t.key === tab)!.count(v.def));
  const selected = views.find((v) => v.def.key === selectedKey) ?? views[0]!;

  const slotsUsed = planet.buildSlots.filter((s) => s !== null).length;
  const slotsFull = slotsUsed >= planet.buildSlots.length;
  const nextFreeAt = slotsFull ? Math.min(...planet.buildSlots.map((s) => s!.endsAt)) : null;

  return (
    <div style={contentStyle}>
      {/* heading + tabs */}
      <div style={headingRowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={titleStyle}>Structures</h1>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {planet.fields.used} of {planet.fields.max} Fields developed · {slotsUsed} of{' '}
            {planet.buildSlots.length} Build Slots in use
          </span>
        </div>
        <div style={tabsStyle}>
          {TABS.map((t) => {
            const count = views.filter((v) => t.count(v.def)).length;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTab(t.key);
                  gridScrollTop();
                }}
                style={tabButtonStyle(active)}
              >
                {t.label} · {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* scrolling card grid */}
      <div id={GRID_ID} style={gridScrollStyle}>
        <div style={gridStyle}>
          {shown.map((v) => (
            <StructureCard
              key={v.def.key}
              view={v}
              now={now}
              selected={v.def.key === selectedKey}
              onSelect={() => setSelectedKey(v.def.key)}
            />
          ))}
        </div>
      </div>

      {/* detail panel */}
      <DetailPanel
        view={selected}
        now={now}
        slotsFull={slotsFull}
        nextFreeAt={nextFreeAt}
        pending={pendingKey === selected.def.key}
        onUpgrade={() => onUpgrade(selected.def.key)}
      />
    </div>
  );
}

const GRID_ID = 'structures-grid';
function gridScrollTop() {
  const el = document.getElementById(GRID_ID);
  if (el) el.scrollTop = 0;
}

function StructureCard({
  view,
  now,
  selected,
  onSelect,
}: {
  view: StructureView;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { def, level, slot } = view;
  let borderColor = 'var(--line)';
  if (selected) borderColor = 'var(--accent)';
  else if (slot) borderColor = 'var(--accent-line)';
  const border = `1px solid ${borderColor}`;
  return (
    <button type="button" onClick={onSelect} style={{ ...cardStyle, border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ArtWell art={def.art} />
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{def.name}</span>
          <span style={cardCategoryStyle}>{def.category}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1 }}>
            {level}
          </span>
          <span style={cardLevelLabelStyle}>LEVEL</span>
        </div>
      </div>
      <div style={{ flexGrow: 1 }} />
      {slot ? (
        <div style={cardFooterStyle}>
          <span style={{ color: 'var(--accent)' }}>Building level {slot.targetLevel}</span>
          <span style={{ fontFamily: 'var(--font-display)' }}>
            {formatCountdown(slot.endsAt - now)}
          </span>
        </div>
      ) : (
        <div style={cardFooterStyle}>
          <span style={{ color: 'var(--text-muted)' }}>
            {level === 0 ? 'NOT BUILT' : `Level ${level}`}
          </span>
          <span style={{ color: view.affordable ? 'var(--text-body)' : 'var(--danger)' }}>
            {formatDuration(view.durationSec)}
          </span>
        </div>
      )}
    </button>
  );
}

function DetailPanel({
  view,
  now,
  slotsFull,
  nextFreeAt,
  pending,
  onUpgrade,
}: {
  view: StructureView;
  now: number;
  slotsFull: boolean;
  nextFreeAt: number | null;
  pending: boolean;
  onUpgrade: () => void;
}) {
  const { def, level, targetLevel, cost, durationSec, slot, affordable } = view;
  const inProgress = slot !== null;
  const blockedBySlots = slotsFull && !inProgress;
  const canUpgrade = !inProgress && !blockedBySlots && affordable && !pending;

  // Explains why the upgrade button is (or isn't) actionable, shown when nothing is building here.
  let idleFootnote = 'Starts now in a free Build Slot';
  if (blockedBySlots && nextFreeAt !== null) {
    idleFootnote = `Both slots busy · frees in ${formatCountdown(nextFreeAt - now)}`;
  } else if (!affordable) {
    idleFootnote = 'Not enough Resources yet';
  } else if (pending) {
    idleFootnote = 'Starting…';
  }

  return (
    <aside style={panelStyle}>
      <div style={panelArtStyle}>
        <ArtWell art={def.art} large />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={panelKickerStyle}>
          {def.category} · LEVEL {level} → {targetLevel}
        </span>
        <h2 style={panelTitleStyle}>{def.name}</h2>
        <p style={panelDescStyle}>{def.description}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StatRow label="Build time" value={formatDuration(durationSec)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={panelKickerStyle}>COST</span>
        <CostLine label="Alloy" amount={cost.alloy} have={view.affordable} color="var(--alloy)" />
        <CostLine
          label="Crystal"
          amount={cost.crystal}
          have={view.affordable}
          color="var(--crystal)"
        />
        {cost.deuterium > 0 && (
          <CostLine
            label="Deuterium"
            amount={cost.deuterium}
            have={view.affordable}
            color="var(--deuterium)"
          />
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {inProgress ? (
          <>
            <button type="button" disabled style={buttonStyle(false)}>
              IN PROGRESS
            </button>
            <span style={panelFootNoteStyle}>
              Finishes in {formatCountdown(slot!.endsAt - now)}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!canUpgrade}
              onClick={onUpgrade}
              style={buttonStyle(canUpgrade)}
            >
              {level === 0 ? 'BUILD' : `UPGRADE TO LEVEL ${targetLevel}`}
            </button>
            <span style={panelFootNoteStyle}>{idleFootnote}</span>
          </>
        )}
      </div>
    </aside>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={statRowStyle}>
      <span style={{ color: 'var(--text-label)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)' }}>{value}</span>
    </div>
  );
}

function CostLine({
  label,
  amount,
  have,
  color,
}: {
  label: string;
  amount: number;
  have: boolean;
  color: string;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)' }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ flexGrow: 1 }}>
        {formatResource(amount)} {label}
      </span>
      <span style={{ fontSize: 12, color: have ? 'var(--accent)' : 'var(--danger)' }}>
        {have ? 'Available' : 'Short'}
      </span>
    </div>
  );
}

/** A neutral art well; the per-Structure scene art lands in the art ticket. */
function ArtWell({ art, large }: { art: string | null; large?: boolean }) {
  const size = large ? 56 : 52;
  return (
    <div style={{ ...artWellStyle, width: size, height: size }} aria-hidden="true">
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-icon)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18 M5.5 21v-9l3.5-3.5h6l3.5 3.5v9 M10 21v-5h4v5 M12 8.5V3" />
        {art === null && <path d="M10.8 2h2.4v2.4h-2.4z" fill="var(--text-icon)" stroke="none" />}
      </svg>
    </div>
  );
}

const contentStyle = {
  position: 'absolute' as const,
  left: 'var(--rail-w)',
  right: 0,
  top: 'var(--topbar-h)',
  bottom: 0,
};

const headingRowStyle = {
  position: 'absolute' as const,
  left: 'var(--content-left)',
  top: 24,
  right: 24,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
};

const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 28,
  letterSpacing: '0.02em',
};

const tabsStyle = {
  display: 'flex',
  gap: 6,
  padding: 4,
  borderRadius: 10,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
};

function tabButtonStyle(active: boolean) {
  return {
    height: 36,
    padding: '0 14px',
    borderRadius: 7,
    border: 0,
    background: active ? 'var(--line)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    cursor: 'pointer',
  };
}

const DETAIL_W = 340;
const gridScrollStyle = {
  position: 'absolute' as const,
  left: 'var(--content-left)',
  top: 104,
  right: DETAIL_W + 48,
  bottom: 24,
  overflowY: 'auto' as const,
  paddingRight: 8,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const cardStyle = {
  boxSizing: 'border-box' as const,
  height: 176,
  textAlign: 'left' as const,
  padding: 16,
  borderRadius: 12,
  background: 'var(--panel)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
  cursor: 'pointer',
};

const cardCategoryStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '0.1em',
  color: 'var(--text-muted)',
};

const cardLevelLabelStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
};

const cardFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 12,
  borderTop: '1px solid var(--line)',
  fontFamily: 'var(--font-display)',
  fontSize: 13,
};

const artWellStyle = {
  flexShrink: 0,
  borderRadius: 10,
  background: 'var(--panel-art)',
  border: '1px solid var(--line-icon)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const panelStyle = {
  position: 'absolute' as const,
  right: 24,
  top: 24,
  width: DETAIL_W,
  bottom: 24,
  boxSizing: 'border-box' as const,
  padding: 20,
  borderRadius: 12,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 18,
};

const panelArtStyle = {
  position: 'relative' as const,
  height: 150,
  flexShrink: 0,
  borderRadius: 10,
  border: '1px solid var(--line-icon)',
  background: 'var(--panel-art)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const panelKickerStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
};

const panelTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 22,
};

const panelDescStyle = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
  color: 'var(--text-body)',
};

const statRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderTop: '1px solid var(--line)',
  fontSize: 14,
};

function buttonStyle(enabled: boolean) {
  return {
    height: 50,
    borderRadius: 10,
    border: 0,
    background: enabled ? 'var(--accent)' : 'var(--line)',
    color: enabled ? '#04120d' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '0.08em',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const panelFootNoteStyle = {
  textAlign: 'center' as const,
  fontSize: 12,
  color: 'var(--text-muted)',
};
