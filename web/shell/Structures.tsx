import { type KeyboardEvent, type ReactNode, useMemo, useState } from 'react';
import { catalogName, STRUCTURES, type StructureDef, type StructureTab } from '#shared/catalog.ts';
import type { BuildSlotView, PlanetSnapshot } from '../lib/api.ts';
import {
  affordableInLabel,
  type CostCheck,
  formatCompact,
  formatCostCompact,
} from '../lib/affordability.ts';
import { formatResource } from '../lib/format.ts';
import { formatCountdown, formatDuration } from '../lib/duration.ts';
import { liveResources } from '../lib/liveResources.ts';
import {
  firstFreeSlot,
  structureAction,
  structureViews,
  type StructureView,
} from '../lib/structures.ts';
import { useServerNow } from '../lib/useServerNow.ts';
import {
  CancelX,
  CheckRow,
  ClockIcon,
  disabledBigButtonStyle,
  LockIcon,
  reasonListStyle,
  XIcon,
} from './stateControls.tsx';
import { ArtIcon, StructureIllustration } from './art.tsx';

interface StructuresProps {
  planet: PlanetSnapshot;
  universeSpeed: number;
  onUpgrade: (key: string) => void;
  onCancel: (slot: number) => void;
  pendingKey: string | null;
}

type TabKey = 'all' | StructureTab;

const TABS: { key: TabKey; label: string; count: (d: StructureDef) => boolean }[] = [
  { key: 'all', label: 'All', count: () => true },
  { key: 'resources', label: 'Resources', count: (d) => d.tab === 'resources' },
  { key: 'facilities', label: 'Facilities', count: (d) => d.tab === 'facilities' },
  { key: 'storage', label: 'Storage', count: (d) => d.tab === 'storage' },
];

/** The Structures screen: filter tabs, a scrolling 3-column card grid, and a detail panel. */
export function Structures({
  planet,
  universeSpeed,
  onUpgrade,
  onCancel,
  pendingKey,
}: StructuresProps) {
  const now = useServerNow(planet.serverNow);
  const live = liveResources(planet, now);
  const [tab, setTab] = useState<TabKey>('all');
  const [selectedKey, setSelectedKey] = useState<string>(STRUCTURES[0]!.key);

  const slotsUsed = planet.buildSlots.filter((s) => s !== null).length;
  const { used, max } = planet.fields;

  const views = useMemo(
    () => structureViews(planet, universeSpeed, live),
    [planet, universeSpeed, live],
  );
  const shown = views.filter((v) => TABS.find((t) => t.key === tab)!.count(v.def));
  const selected = views.find((v) => v.def.key === selectedKey) ?? views[0]!;

  // The slot that frees first, for the "SLOT FREES IN" countdowns.
  const firstFree = firstFreeSlot(planet);

  return (
    <div style={contentStyle}>
      {/* heading + tabs */}
      <div style={headingRowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={titleStyle}>Structures</h1>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {used} of {max} Fields developed · {slotsUsed} of {planet.buildSlots.length} Build Slots
            in use
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
              nextFreeAt={firstFree?.endsAt ?? null}
              selected={v.def.key === selectedKey}
              pending={pendingKey === v.def.key}
              onSelect={() => setSelectedKey(v.def.key)}
              onUpgrade={() => onUpgrade(v.def.key)}
              onCancel={onCancel}
            />
          ))}
        </div>
      </div>

      {/* detail panel */}
      <DetailPanel
        view={selected}
        now={now}
        planet={planet}
        firstFree={firstFree}
        pending={pendingKey === selected.def.key}
        onUpgrade={() => onUpgrade(selected.def.key)}
        onCancel={onCancel}
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
  nextFreeAt,
  selected,
  pending,
  onSelect,
  onUpgrade,
  onCancel,
}: {
  view: StructureView;
  now: number;
  nextFreeAt: number | null;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
  onUpgrade: () => void;
  onCancel: (slot: number) => void;
}) {
  const { def, level, slot, state } = view;
  let borderColor = 'var(--line)';
  if (selected) borderColor = 'var(--accent)';
  else if (slot) borderColor = 'var(--accent-line)';
  const border = `1px solid ${borderColor}`;
  // The card holds its own buttons (✕, UPGRADE), so it is a focusable div rather than a <button>.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{ ...cardStyle, border }}
    >
      <StructureIllustration art={def.art} />
      <div style={cardShadeStyle} />
      <div style={cardFootShadeStyle} />
      <div style={cardBodyStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconWell art={def.art} />
          <div
            style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>{def.name}</span>
            <span style={cardCategoryStyle}>{def.category}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {state === 'locked' ? (
              <Chip>LOCKED</Chip>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  lineHeight: 1,
                  color: slot ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {level}
              </span>
            )}
            <span style={cardLevelLabelStyle}>{level === 0 ? 'NOT BUILT' : 'LEVEL'}</span>
          </div>
        </div>
        <div style={{ flexGrow: 1 }} />
        {slot ? (
          <div
            style={{ ...cardFooterStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--accent)', flexGrow: 1 }}>
                Building level {slot.targetLevel}
              </span>
              <span>{formatCountdown(slot.endsAt - now)}</span>
              <CancelX label={def.name} onClick={() => onCancel(slot.slot)} />
            </div>
            <RefundLine cost={slot.cost} />
          </div>
        ) : (
          <div style={cardFooterStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <CostFigures checks={view.checks} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {formatDuration(view.durationSec)}
              </span>
            </div>
            <CardAction
              view={view}
              now={now}
              nextFreeAt={nextFreeAt}
              pending={pending}
              onUpgrade={onUpgrade}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact cost figures on a card; the short ones turn red (#14 B+C). */
function CostFigures({ checks }: { checks: CostCheck[] }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {checks.map((c) => (
        <span
          key={c.resource}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: c.met ? 'var(--text)' : 'var(--danger)',
          }}
        >
          <ResourceDot resource={c.resource} />
          {formatCompact(c.need)}
        </span>
      ))}
    </div>
  );
}

/** The card's button: UPGRADE/BUILD when ready, otherwise disabled with its reason. */
function CardAction({
  view,
  now,
  nextFreeAt,
  pending,
  onUpgrade,
}: {
  view: StructureView;
  now: number;
  nextFreeAt: number | null;
  pending: boolean;
  onUpgrade: () => void;
}) {
  const action = structureAction(view, now, nextFreeAt);
  if (action.enabled) {
    return (
      <button
        type="button"
        disabled={pending}
        aria-label={`Upgrade ${view.def.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onUpgrade();
        }}
        style={cardButtonStyle(true)}
      >
        {action.label}
      </button>
    );
  }
  return (
    <button type="button" disabled style={cardButtonStyle(false)}>
      {action.icon === 'clock' ? <ClockIcon /> : <LockIcon />}
      {action.label}
    </button>
  );
}

function DetailPanel({
  view,
  now,
  planet,
  firstFree,
  pending,
  onUpgrade,
  onCancel,
}: {
  view: StructureView;
  now: number;
  planet: PlanetSnapshot;
  firstFree: BuildSlotView | null;
  pending: boolean;
  onUpgrade: () => void;
  onCancel: (slot: number) => void;
}) {
  const { def, level, targetLevel, cost, durationSec, slot, state } = view;
  const levelFrom = level === 0 ? 'NOT BUILT' : `LEVEL ${level}`;
  const costMet = (r: CostCheck['resource']) =>
    view.checks.find((c) => c.resource === r)?.met ?? true;

  return (
    <aside style={panelStyle}>
      <div style={panelArtStyle}>
        <StructureIllustration art={def.art} skyWidth={1.6} />
        <div style={panelArtShadeStyle} />
        <div style={panelIconBadgeStyle}>
          <ArtIcon art={def.art} size={24} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={panelKickerStyle}>
          {def.category} · {levelFrom} → LEVEL {targetLevel}
        </span>
        <h2 style={panelTitleStyle}>{def.name}</h2>
        <p style={panelDescStyle}>{def.description}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StatRow label="Build time" value={formatDuration(durationSec)} />
        <StatRow label="Fields" value="+1" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {view.requirements.length > 0 && state === 'locked' && (
          <>
            <span style={panelKickerStyle}>REQUIREMENTS</span>
            {view.requirements.map((r) => (
              <CheckRow
                key={r.key}
                ok={r.met}
                label={r.name}
                value={`${r.current} / ${r.required}`}
              />
            ))}
            <div style={{ height: 4 }} />
          </>
        )}
        <span style={panelKickerStyle}>COST</span>
        <CostLine label="Alloy" amount={cost.alloy} have={costMet('alloy')} color="var(--alloy)" />
        <CostLine
          label="Crystal"
          amount={cost.crystal}
          have={costMet('crystal')}
          color="var(--crystal)"
        />
        {cost.deuterium > 0 && (
          <CostLine
            label="Deuterium"
            amount={cost.deuterium}
            have={costMet('deuterium')}
            color="var(--deuterium)"
          />
        )}
        {state === 'short' && (
          <div style={reasonListStyle}>
            {view.checks.map((c) => (
              <CheckRow
                key={c.resource}
                ok={c.met}
                label={c.label}
                value={`${formatResource(c.have)} / ${formatResource(c.need)}`}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DetailAction
          view={view}
          now={now}
          planet={planet}
          firstFree={firstFree}
          pending={pending}
          onUpgrade={onUpgrade}
          onCancel={() => slot && onCancel(slot.slot)}
        />
      </div>
    </aside>
  );
}

/** The detail panel's button and the footnote under it, one per upgrade state (#14 picks). */
function DetailAction({
  view,
  now,
  planet,
  firstFree,
  pending,
  onUpgrade,
  onCancel,
}: {
  view: StructureView;
  now: number;
  planet: PlanetSnapshot;
  firstFree: BuildSlotView | null;
  pending: boolean;
  onUpgrade: () => void;
  onCancel: () => void;
}) {
  const { level, targetLevel, slot, state } = view;

  if (state === 'building' && slot) {
    return (
      <>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
          <XIcon />
          CANCEL UPGRADE · {formatCountdown(slot.endsAt - now)}
        </button>
        <span style={panelFootNoteStyle}>
          Cancel refunds {formatCostCompact(slot.cost)} · Field returned
        </span>
      </>
    );
  }

  if (state === 'ready') {
    return (
      <>
        <button type="button" disabled={pending} onClick={onUpgrade} style={buttonStyle(!pending)}>
          {level === 0 ? 'BUILD' : `UPGRADE TO LEVEL ${targetLevel}`}
        </button>
        <span style={panelFootNoteStyle}>
          {pending ? 'Starting…' : 'Starts now in a free Build Slot'}
        </span>
      </>
    );
  }

  let icon: ReactNode = <LockIcon size={14} />;
  let label: string;
  let footnote: string;
  if (state === 'locked') {
    const met = view.requirements.filter((r) => r.met).length;
    label = 'LOCKED';
    footnote = `${met} of ${view.requirements.length} requirements met · current levels only`;
  } else if (state === 'research_active') {
    icon = <ClockIcon size={14} />;
    label = `LAB FREE IN ${formatCountdown((view.lockEndsAt ?? now) - now)}`;
    const queue = planet.researchQueue;
    const name = queue[0] ? catalogName(queue[0].technology) : 'Research';
    footnote =
      queue.length > 1
        ? `Free when the Research Queue finishes · ${queue.length} entries`
        : `Free when ${name} finishes`;
  } else if (state === 'shipyard_busy') {
    icon = <ClockIcon size={14} />;
    label = `ORDERS FINISH IN ${formatCountdown((view.lockEndsAt ?? now) - now)}`;
    const orders = planet.shipyardOrders.length;
    footnote = `Free when ${orders === 1 ? 'the Shipyard Order finishes' : `all ${orders} Shipyard Orders finish`}`;
  } else if (state === 'slots_full') {
    icon = <ClockIcon size={14} />;
    label = firstFree
      ? `SLOT FREES IN ${formatCountdown(firstFree.endsAt - now)}`
      : 'BUILD SLOTS FULL';
    const name = firstFree ? (STRUCTURE_NAMES.get(firstFree.structure) ?? firstFree.structure) : '';
    footnote = `No waiting list — come back when ${name} finishes`;
  } else if (state === 'fields_full') {
    const { used, inProgress, max } = planet.fields;
    label = 'NO FREE FIELDS';
    footnote = `${used} used + ${inProgress} building of ${max} Fields`;
  } else {
    icon = <ClockIcon size={14} />;
    label = affordableInLabel(view.affordableInSec);
    footnote =
      view.affordableInSec === null
        ? 'Not reachable at current production or Storage Capacity'
        : `At current production · ${ratesLine(view, planet)}`;
  }
  return (
    <>
      <button type="button" disabled style={disabledBigButtonStyle}>
        {icon}
        {label}
      </button>
      <span style={panelFootNoteStyle}>{footnote}</span>
    </>
  );
}

const STRUCTURE_NAMES = new Map<string, string>(STRUCTURES.map((d) => [d.key, d.name]));

/** "Alloy +42.1k/h · Crystal +21.9k/h" for the Resources this upgrade is short of. */
function ratesLine(view: StructureView, planet: PlanetSnapshot): string {
  return view.checks
    .filter((c) => !c.met)
    .map((c) => `${c.label} +${formatCompact(planet.ratesPerHour[c.resource])}/h`)
    .join(' · ');
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
      <span style={{ flexGrow: 1, color: have ? 'var(--text)' : 'var(--danger)' }}>
        {formatResource(amount)} {label}
      </span>
      <span style={{ fontSize: 12, color: have ? 'var(--accent)' : 'var(--danger)' }}>
        {have ? 'Available' : 'Short'}
      </span>
    </div>
  );
}

function RefundLine({ cost }: { cost: BuildSlotView['cost'] }) {
  return (
    <div style={refundLineStyle}>
      <span>Cancel refunds {formatCostCompact(cost)}</span>
      <span>Field returned</span>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span style={chipStyle}>{children}</span>;
}

const RESOURCE_COLORS = {
  alloy: 'var(--alloy)',
  crystal: 'var(--crystal)',
  deuterium: 'var(--deuterium)',
};
function ResourceDot({ resource }: { resource: CostCheck['resource'] }) {
  return (
    <span
      style={{ width: 7, height: 7, borderRadius: '50%', background: RESOURCE_COLORS[resource] }}
    />
  );
}

/** The card's icon well: the Structure's own icon over the scene. */
function IconWell({ art }: { art: string }) {
  return (
    <div style={iconWellStyle} aria-hidden="true">
      <ArtIcon art={art} size={28} />
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
  position: 'relative' as const,
  overflow: 'hidden',
  boxSizing: 'border-box' as const,
  height: 176,
  textAlign: 'left' as const,
  borderRadius: 12,
  background: 'var(--panel)',
  color: 'var(--text)',
  cursor: 'pointer',
};

// The design's two shades keep the text readable over the scene: left to right, then the foot.
const cardShadeStyle = {
  position: 'absolute' as const,
  inset: 0,
  background:
    'linear-gradient(90deg, rgba(11,17,25,0.94) 0%, rgba(11,17,25,0.62) 42%, rgba(11,17,25,0.04) 100%)',
};

const cardFootShadeStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: 96,
  background: 'linear-gradient(0deg, rgba(11,17,25,0.97) 20%, rgba(11,17,25,0))',
};

const cardBodyStyle = {
  position: 'relative' as const,
  boxSizing: 'border-box' as const,
  height: '100%',
  padding: 16,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
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

const iconWellStyle = {
  flexShrink: 0,
  width: 52,
  height: 52,
  borderRadius: 10,
  background: 'var(--icon-well)',
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
  overflow: 'hidden',
  height: 150,
  flexShrink: 0,
  borderRadius: 10,
  border: '1px solid var(--line-icon)',
  background: 'var(--panel)',
};

const panelArtShadeStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  bottom: 0,
  height: 50,
  background: 'linear-gradient(0deg, rgba(11,17,25,0.85), rgba(11,17,25,0))',
};

const panelIconBadgeStyle = {
  position: 'absolute' as const,
  left: 12,
  top: 12,
  width: 40,
  height: 40,
  borderRadius: 9,
  background: 'rgba(11,17,25,0.85)',
  border: '1px solid var(--line-icon)',
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

function cardButtonStyle(enabled: boolean) {
  return {
    height: 36,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${enabled ? 'var(--line-strong)' : 'var(--line)'}`,
    background: enabled ? 'transparent' : 'var(--icon-well)',
    color: enabled ? 'var(--text)' : 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: '0.06em',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const secondaryButtonStyle = {
  ...disabledBigButtonStyle,
  border: '1px solid var(--line-strong)',
  background: 'transparent',
  color: 'var(--text-body)',
  cursor: 'pointer',
};

const refundLineStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const chipStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: '0.12em',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--line-strong)',
  color: 'var(--text-label)',
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.3,
};
