import { useMemo, useState } from 'react';
import { catalogName, TECH_LANES, TECHNOLOGIES, technologyDef } from '#shared/catalog.ts';
import type { PlanetSnapshot, ResearchEntryView } from '../lib/api.ts';
import { formatResource } from '../lib/format.ts';
import { formatCountdown, formatDuration } from '../lib/duration.ts';
import { liveResources } from '../lib/liveResources.ts';
import {
  nodeStatus,
  type NodeTone,
  queueAction,
  researchProgress,
  techView,
  type TechView,
} from '../lib/research.ts';
import { useServerNow } from '../lib/useServerNow.ts';
import { TECH_ICONS } from './techIcons.ts';

interface ResearchProps {
  planet: PlanetSnapshot;
  universeSpeed: number;
  onEnqueue: (technology: string) => void;
  pendingKey: string | null;
  onGoToStructures: () => void;
}

/**
 * The Research screen: the heading with the active entry and a "+N queued" dropdown, the four
 * Technology lanes, and a detail panel with requirements, cost and the queue button. With no
 * Research Lab it shows a blocking panel instead (spec stories 52–57, 64, 65).
 */
export function Research({
  planet,
  universeSpeed,
  onEnqueue,
  pendingKey,
  onGoToStructures,
}: ResearchProps) {
  const now = useServerNow(planet.serverNow);
  const live = liveResources(planet, now);
  const [selectedKey, setSelectedKey] = useState<string>(TECHNOLOGIES[0]!.key);
  const [queueOpen, setQueueOpen] = useState(false);

  const views = useMemo(
    () =>
      new Map<string, TechView>(
        TECHNOLOGIES.map((def) => [def.key, techView(def, planet, universeSpeed, live)]),
      ),
    [planet, universeSpeed, live],
  );
  const selected = views.get(selectedKey) ?? views.get(TECHNOLOGIES[0]!.key)!;
  const lab = planet.structures['research-lab'] ?? 0;

  if (lab === 0) {
    return (
      <div style={contentStyle}>
        <div style={headingRowStyle}>
          <Heading lab={lab} />
        </div>
        <div style={blockingStyle}>
          <TechGlyph icon="energy" size={56} />
          <h2 style={blockingTitleStyle}>No Research Lab yet</h2>
          <p style={blockingTextStyle}>
            Build a Research Lab on the Structures screen to start researching Technologies.
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
      <div style={headingRowStyle}>
        <Heading lab={lab} />
        <QueueBox
          queue={planet.researchQueue}
          now={now}
          open={queueOpen}
          onToggle={() => setQueueOpen((o) => !o)}
        />
      </div>

      {queueOpen && planet.researchQueue.length > 0 && (
        <QueueDropdown queue={planet.researchQueue} now={now} />
      )}

      <div style={lanesStyle}>
        {TECH_LANES.map((lane) => (
          <section key={lane.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={laneTitleStyle}>{lane.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {TECHNOLOGIES.filter((t) => t.lane === lane.key).map((def, i) => {
                const view = views.get(def.key)!;
                const locked = nodeStatus(view).tone === 'locked';
                return (
                  <div key={def.key} style={{ display: 'flex', alignItems: 'center' }}>
                    {i > 0 && <Connector locked={locked} />}
                    <TechNode
                      view={view}
                      selected={def.key === selected.def.key}
                      onSelect={() => setSelectedKey(def.key)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <DetailPanel
        view={selected}
        planet={planet}
        pending={pendingKey === selected.def.key}
        onEnqueue={() => onEnqueue(selected.def.key)}
      />
    </div>
  );
}

/** "Research" plus "Research Lab N" (story 64: no mention of colonies). */
function Heading({ lab }: { lab: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h1 style={titleStyle}>Research</h1>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Research Lab {lab}</span>
    </div>
  );
}

/** The header box: the active entry with its countdown and bar, and the "+N queued" chip. */
function QueueBox({
  queue,
  now,
  open,
  onToggle,
}: {
  queue: ResearchEntryView[];
  now: number;
  open: boolean;
  onToggle: () => void;
}) {
  const head = queue[0];
  if (!head) {
    return (
      <div style={{ ...queueBoxStyle, borderColor: 'var(--line)' }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>No Research running</span>
      </div>
    );
  }
  const waiting = queue.length - 1;
  return (
    <div style={queueBoxStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
        <span>
          {catalogName(head.technology)}{' '}
          <span style={{ color: 'var(--text-muted)' }}>→ level {head.targetLevel}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {waiting > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              style={queuedChipStyle}
              title="Show the Research Queue"
            >
              +{waiting} queued {open ? '▴' : '▾'}
            </button>
          )}
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
            {head.endsAt !== null ? formatCountdown(head.endsAt - now) : '—'}
          </span>
        </span>
      </div>
      <ProgressBar value={researchProgress(head, now)} />
    </div>
  );
}

/** The dropdown over the lanes listing every queue entry, in order. */
function QueueDropdown({ queue, now }: { queue: ResearchEntryView[]; now: number }) {
  return (
    <div style={dropdownStyle} role="list" aria-label="Research Queue">
      {queue.map((e, i) => (
        <div key={e.id} role="listitem" style={dropdownRowStyle}>
          <span style={dropdownIndexStyle}>{i + 1}</span>
          <TechGlyph icon={technologyDef(e.technology)?.icon ?? 'energy'} size={22} />
          <span style={{ flexGrow: 1 }}>
            {catalogName(e.technology)}{' '}
            <span style={{ color: 'var(--text-muted)' }}>→ {e.targetLevel}</span>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              color: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {i === 0 && e.endsAt !== null ? formatCountdown(e.endsAt - now) : 'queued'}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height: 4, borderRadius: 4, background: 'var(--line)' }}>
      <div
        style={{
          width: `${Math.round(value * 100)}%`,
          height: 4,
          borderRadius: 4,
          background: 'var(--accent)',
        }}
      />
    </div>
  );
}

function Connector({ locked }: { locked: boolean }) {
  return (
    <div
      style={{
        width: 44,
        height: 0,
        borderTop: `1px ${locked ? 'dashed' : 'solid'} ${locked ? '#2a3a4d' : '#3b4d63'}`,
      }}
    />
  );
}

const STATUS_COLOR: Record<NodeTone, string> = {
  busy: 'var(--accent)',
  locked: 'var(--text-muted)',
  idle: 'var(--text-label)',
};

function TechNode({
  view,
  selected,
  onSelect,
}: {
  view: TechView;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = nodeStatus(view);
  const locked = status.tone === 'locked';
  let borderColor = 'var(--line)';
  if (selected) borderColor = 'var(--accent)';
  else if (status.tone === 'busy') borderColor = 'var(--accent-line)';
  else if (locked) borderColor = 'var(--line-strong)';
  let background = 'var(--panel)';
  if (selected) background = 'var(--accent-select)';
  else if (locked) background = 'transparent';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        ...nodeStyle,
        border: `1px ${locked ? 'dashed' : 'solid'} ${borderColor}`,
        background,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <span style={nodeIconWellStyle}>
        <TechGlyph icon={view.def.icon} size={26} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{view.def.name}</span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            color: STATUS_COLOR[status.tone],
          }}
        >
          {status.text}
        </span>
      </span>
    </button>
  );
}

function DetailPanel({
  view,
  planet,
  pending,
  onEnqueue,
}: {
  view: TechView;
  planet: PlanetSnapshot;
  pending: boolean;
  onEnqueue: () => void;
}) {
  const { def, level, targetLevel, cost, durationSec, requirements } = view;
  const action = queueAction(planet, view);
  const enabled = action.enabled && !pending;
  const lane = TECH_LANES.find((l) => l.key === def.lane)!;
  const costParts = [
    cost.alloy > 0 && `${formatResource(cost.alloy)} Alloy`,
    cost.crystal > 0 && `${formatResource(cost.crystal)} Crystal`,
    cost.deuterium > 0 && `${formatResource(cost.deuterium)} Deut`,
  ].filter(Boolean);

  return (
    <aside style={panelStyle}>
      <div style={panelArtStyle}>
        <TechGlyph icon={def.icon} size={90} strokeWidth={0.8} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={kickerStyle}>
          {lane.title} · LEVEL {level} → {targetLevel}
        </span>
        <h2 style={panelTitleStyle}>{def.name}</h2>
        <p style={panelDescStyle}>{def.description}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StatRow label="Cost" value={costParts.length > 0 ? costParts.join(' · ') : 'Free'} />
        {def.energyRequired !== undefined && (
          <StatRow
            label="Energy capacity"
            value={formatResource(def.energyRequired * def.factor ** (targetLevel - 1))}
          />
        )}
        <StatRow label="Research time" value={formatDuration(durationSec)} last />
      </div>

      {requirements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={kickerStyle}>REQUIREMENTS</span>
          {requirements.map((r) => {
            const color = r.met ? 'var(--accent)' : 'var(--danger)';
            return (
              <div
                key={r.key}
                style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-label={r.met ? 'met' : 'not met'}
                >
                  <path d={r.met ? 'M5 12.5l4.5 4.5L19 7.5' : 'M7 7l10 10 M17 7L7 17'} />
                </svg>
                <span style={{ flexGrow: 1 }}>{r.name}</span>
                <span style={{ fontFamily: 'var(--font-display)', color }}>
                  {r.have} / {r.need}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          disabled={!enabled}
          onClick={onEnqueue}
          style={outlineButtonStyle(enabled)}
        >
          {pending ? 'QUEUING…' : action.label}
        </button>
        <span style={footNoteStyle}>One research runs at a time · paid when queued</span>
      </div>
    </aside>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        ...statRowStyle,
        borderBottom: last ? '1px solid var(--line)' : undefined,
      }}
    >
      <span style={{ color: 'var(--text-label)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)' }}>{value}</span>
    </div>
  );
}

/** A Technology icon: the stroke in the icon colour, the small fill in the accent. */
function TechGlyph({
  icon,
  size,
  strokeWidth = 1.4,
}: {
  icon: string;
  size: number;
  strokeWidth?: number;
}) {
  const glyph = TECH_ICONS[icon] ?? TECH_ICONS.energy!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-icon)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={glyph.path} />
      <path d={glyph.fill} fill="var(--accent)" stroke="none" />
    </svg>
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

const headingRowStyle = {
  position: 'absolute' as const,
  left: 24,
  top: 24,
  width: 948,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 28,
};

const queueBoxStyle = {
  width: 380,
  boxSizing: 'border-box' as const,
  padding: '12px 16px',
  borderRadius: 10,
  background: 'var(--panel)',
  border: '1px solid var(--accent-line)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
};

const queuedChipStyle = {
  height: 22,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--line-strong)',
  background: 'transparent',
  color: 'var(--text-body)',
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  cursor: 'pointer',
};

const dropdownStyle = {
  position: 'absolute' as const,
  left: 24 + 948 - 380,
  top: 96,
  width: 380,
  zIndex: 5,
  boxSizing: 'border-box' as const,
  padding: 8,
  borderRadius: 10,
  background: 'var(--panel)',
  border: '1px solid var(--line-strong)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
};

const dropdownRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 8px',
  borderRadius: 6,
  fontSize: 14,
};

const dropdownIndexStyle = {
  width: 14,
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const lanesStyle = {
  position: 'absolute' as const,
  left: 24,
  top: 124,
  width: 948,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 26,
};

const laneTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: '0.14em',
  color: 'var(--text-muted)',
};

const nodeStyle = {
  width: 203,
  height: 88,
  flexShrink: 0,
  boxSizing: 'border-box' as const,
  padding: 12,
  borderRadius: 10,
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  textAlign: 'left' as const,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};

const nodeIconWellStyle = {
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: 9,
  background: '#111925',
  border: '1px solid var(--line-icon)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const panelStyle = {
  position: 'absolute' as const,
  right: 24,
  top: 24,
  width: 340,
  height: 780,
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
  height: 140,
  flexShrink: 0,
  borderRadius: 10,
  border: '1px solid var(--line-icon)',
  backgroundColor: 'var(--panel-art)',
  backgroundImage:
    'linear-gradient(var(--accent-grid) 1px, transparent 1px), linear-gradient(90deg, var(--accent-grid) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
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

function outlineButtonStyle(enabled: boolean) {
  return {
    height: 50,
    borderRadius: 10,
    border: '1px solid var(--line-strong)',
    background: 'transparent',
    color: enabled ? 'var(--text)' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '0.08em',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

function primaryButtonStyle(enabled: boolean) {
  return {
    height: 50,
    padding: '0 28px',
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

const footNoteStyle = {
  textAlign: 'center' as const,
  fontSize: 12,
  color: 'var(--text-muted)',
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
