'use client';

import { useMemo } from 'react';
import { diagramFor, seedFrom, type DiagramKind } from '@/lib/conceptDiagram';

const W = 400;
const H = 300;

/** Each element enters on a stagger, so a diagram assembles rather than
 *  appearing. Motion is CSS-driven and respects prefers-reduced-motion, which
 *  also means a headless screenshot captures the finished state. */
function delay(i: number): React.CSSProperties {
  return { animationDelay: `${i * 90}ms` };
}

/** Delay plus the shape's resting opacity, handed to the keyframes as --o.
 *  Without it, `to { opacity: 1 }` under fill-mode: both permanently overrides
 *  each shape's own opacity attribute and flattens the depth hierarchy. Shapes
 *  wrapped in an animated <g> don't need this — group opacity multiplies. */
function anim(i: number, o: number): React.CSSProperties {
  return { animationDelay: `${i * 90}ms`, '--o': o } as React.CSSProperties;
}

/** Passed down per render so a still thumbnail and an animating canvas can
 *  coexist — module-level state would leak between instances. */
type Cls = (name: string) => string;

interface DrawProps {
  labels: string[];
  rand: () => number;
  cls: Cls;
}

function Zones({ labels, rand, cls }: DrawProps) {
  // Slice the plate into a coarse mosaic — proportions vary per slide but stay
  // stable for the same slide.
  const rows = labels.length <= 3 ? 1 : 2;
  const perRow = Math.ceil(labels.length / rows);
  const gap = 6;
  const rowH = (H - gap * (rows - 1)) / rows;

  return (
    <>
      {labels.map((label, i) => {
        const r = Math.floor(i / perRow);
        const c = i % perRow;
        const inRow = Math.min(perRow, labels.length - r * perRow);
        const colW = (W - gap * (inRow - 1)) / inRow;
        const jitter = 0.82 + rand() * 0.18;
        return (
          <g key={label} className={cls("cd-in")} style={delay(i)}>
            <rect
              x={c * (colW + gap)}
              y={r * (rowH + gap)}
              width={colW}
              height={rowH * jitter}
              rx={3}
              fill="var(--accent)"
              opacity={0.14 + (i % 4) * 0.14}
            />
          </g>
        );
      })}
    </>
  );
}

function Nodes({ labels, rand, cls }: DrawProps) {
  const pts = labels.map((_, i) => {
    const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
    const rr = 88 + rand() * 26;
    return { x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr * 0.72 };
  });

  return (
    <>
      {pts.map((p, i) =>
        pts.slice(i + 1).map((q, j) => (
          <line
            key={`${i}-${j}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="var(--accent)"
            strokeWidth={j === 0 ? 1.6 : 0.6}
            opacity={j === 0 ? 0.4 : 0.16}
            className={cls("cd-draw")}
            style={anim(i, j === 0 ? 0.4 : 0.16)}
          />
        )),
      )}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 ? 13 : 9}
          fill="var(--accent)"
          opacity={i === 0 ? 0.95 : 0.5}
          className={cls("cd-pop")}
          style={anim(i, i === 0 ? 0.95 : 0.5)}
        />
      ))}
    </>
  );
}

function Paths({ labels, rand, cls }: DrawProps) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} rx={4} fill="var(--accent)" opacity={0.06} />
      {labels.map((label, i) => {
        const y = 40 + (i * (H - 80)) / Math.max(1, labels.length - 1 || 1);
        const bend = 40 + rand() * 90;
        const d = `M 12 ${y} C ${W * 0.3} ${y - bend}, ${W * 0.7} ${y + bend}, ${W - 12} ${y}`;
        return (
          <path
            key={label}
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={i === 0 ? 2.6 : 1.4}
            strokeLinecap="round"
            opacity={i === 0 ? 0.9 : 0.4}
            className={cls("cd-draw")}
            style={anim(i, i === 0 ? 0.9 : 0.4)}
          />
        );
      })}
    </>
  );
}

function Layers({ labels, cls }: DrawProps) {
  return (
    <>
      {labels.map((label, i) => {
        const inset = (i * Math.min(W, H) * 0.32) / Math.max(1, labels.length);
        return (
          <rect
            key={label}
            x={inset}
            y={inset * 0.75}
            width={W - inset * 2}
            height={H - inset * 1.5}
            rx={6}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            opacity={0.85 - i * 0.16}
            className={cls("cd-pop")}
            style={anim(i, 0.85 - i * 0.16)}
          />
        );
      })}
    </>
  );
}

function Grid({ labels, rand, cls }: DrawProps) {
  const cols = 10;
  const rows = 7;
  const cell = Math.min(W / cols, H / rows);
  const filled = Math.max(0.25, Math.min(0.85, 0.3 + labels.length * 0.1));
  const cells = Array.from({ length: cols * rows });

  return (
    <>
      {cells.map((_, i) => {
        const on = rand() < filled;
        return (
          <rect
            key={i}
            x={(i % cols) * cell + 3}
            y={Math.floor(i / cols) * cell + 3}
            width={cell - 6}
            height={cell - 6}
            rx={2}
            fill="var(--accent)"
            opacity={on ? 0.55 : 0.1}
            className={cls("cd-in")}
            style={{ animationDelay: `${(i % cols) * 22 + Math.floor(i / cols) * 40}ms`, '--o': on ? 0.55 : 0.1 } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

function Section({ labels, cls }: DrawProps) {
  return (
    <>
      {/* Floor plate and a facade to the left, with light entering it. */}
      <rect x={0} y={H - 46} width={W} height={8} rx={2} fill="var(--accent)" opacity={0.5} />
      <rect x={0} y={54} width={9} height={H - 100} rx={2} fill="var(--accent)" opacity={0.35} />
      {labels.map((label, i) => {
        const y = 66 + i * 16;
        const reach = W * (0.9 - i * 0.13);
        return (
          <line
            key={label}
            x1={14}
            y1={y}
            x2={reach}
            y2={H - 52}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7 - i * 0.1}
            className={cls("cd-draw")}
            style={anim(i, 0.7 - i * 0.1)}
          />
        );
      })}
      <circle cx={26} cy={34} r={13} fill="var(--accent)" opacity={0.9} className={cls("cd-pop")} style={anim(0, 0.9)} />
    </>
  );
}

function Radial({ labels, cls }: DrawProps) {
  const cx = W / 2;
  const cy = H / 2;
  return (
    <>
      {labels.map((label, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * 105;
        const y = cy + Math.sin(a) * 88;
        return (
          <g key={label} className={cls("cd-pop")} style={delay(i)}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--accent)" strokeWidth={1.3} opacity={0.3} />
            <circle cx={x} cy={y} r={13} fill="var(--accent)" opacity={0.28 + (i % 3) * 0.18} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={26} fill="var(--accent)" opacity={0.95} className={cls("cd-pop")} style={anim(0, 0.95)} />
    </>
  );
}

function Bars({ labels, rand, cls }: DrawProps) {
  const gap = 14;
  const bw = (W - gap * (labels.length - 1)) / labels.length;
  return (
    <>
      <line x1={0} y1={H - 30} x2={W} y2={H - 30} stroke="var(--accent)" strokeWidth={1} opacity={0.3} />
      {labels.map((label, i) => {
        const h = 52 + rand() * (H - 110);
        return (
          <rect
            key={label}
            x={i * (bw + gap)}
            y={H - 30 - h}
            width={bw}
            height={h}
            rx={3}
            fill="var(--accent)"
            opacity={0.25 + (i % 3) * 0.22}
            className={cls("cd-rise")}
            style={anim(i, 0.25 + (i % 3) * 0.22)}
          />
        );
      })}
    </>
  );
}

function Sequence({ labels, cls }: DrawProps) {
  const n = labels.length;
  const step = W / Math.max(1, n);
  return (
    <>
      <line
        x1={step / 2}
        y1={H / 2}
        x2={W - step / 2}
        y2={H / 2}
        stroke="var(--accent)"
        strokeWidth={2}
        opacity={0.25}
        className={cls("cd-draw")}
        style={anim(0, 0.25)}
      />
      {labels.map((label, i) => {
        const x = step / 2 + i * step;
        return (
          <g key={label} className={cls("cd-pop")} style={delay(i)}>
            <circle cx={x} cy={H / 2} r={19} fill="var(--accent)" opacity={0.18 + i * 0.13} />
            <text
              x={x}
              y={H / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill="var(--accent)"
              opacity={0.95}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Organic({ labels, rand, cls }: DrawProps) {
  return (
    <>
      {labels.map((label, i) => {
        const cx = 70 + rand() * (W - 140);
        const cy = 70 + rand() * (H - 140);
        const r = 34 + rand() * 46;
        return (
          <circle
            key={label}
            cx={cx}
            cy={cy}
            r={r}
            fill="var(--accent)"
            opacity={0.13 + (i % 3) * 0.1}
            className={cls("cd-pop")}
            style={anim(i, 0.13 + (i % 3) * 0.1)}
          />
        );
      })}
      {labels.map((label, i) => {
        const y = H - 26 - i * 5;
        return (
          <path
            key={`stem-${label}`}
            d={`M ${60 + i * 62} ${y} C ${52 + i * 62} ${y - 52}, ${86 + i * 62} ${y - 70}, ${72 + i * 62} ${y - 104}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.6}
            className={cls("cd-draw")}
            style={anim(i, 0.6)}
          />
        );
      })}
    </>
  );
}

function Stack({ labels, cls }: DrawProps) {
  const gap = 7;
  const h = (H - gap * (labels.length - 1)) / labels.length;
  return (
    <>
      {labels.map((label, i) => (
        <rect
          key={label}
          x={i * 9}
          y={i * (h + gap)}
          width={W - i * 18}
          height={h}
          rx={3}
          fill="var(--accent)"
          opacity={0.18 + i * 0.15}
          className={cls("cd-slide")}
          style={anim(i, 0.18 + i * 0.15)}
        />
      ))}
    </>
  );
}

const RENDERERS: Record<DiagramKind, (p: DrawProps) => React.ReactNode> = {
  zones: Zones,
  nodes: Nodes,
  paths: Paths,
  layers: ({ labels, cls }) => <Layers labels={labels} cls={cls} rand={() => 0} />,
  grid: Grid,
  section: ({ labels, cls }) => <Section labels={labels} cls={cls} rand={() => 0} />,
  radial: ({ labels, cls }) => <Radial labels={labels} cls={cls} rand={() => 0} />,
  bars: Bars,
  sequence: ({ labels, cls }) => <Sequence labels={labels} cls={cls} rand={() => 0} />,
  organic: Organic,
  stack: ({ labels, cls }) => <Stack labels={labels} cls={cls} rand={() => 0} />,
};

/** A generated diagram for a concept slide, drawn from the slide's own points
 *  and tinted with the deck accent. Replaced by a real image the moment one is
 *  pasted in — this is the default, not a lock-in. */
export function ConceptDiagram({
  pillarId,
  conceptId,
  labels,
  seedKey,
  animate = false,
  className,
}: {
  pillarId?: string;
  conceptId?: string;
  labels: string[];
  /** Keeps a given slide's layout stable across renders. */
  seedKey: string;
  animate?: boolean;
  className?: string;
}) {
  const kind = diagramFor(pillarId, conceptId);
  // Joined first so the memo depends on a plain string, not a fresh array.
  const labelKey = labels.length ? labels.join('|') : 'One|Two|Three';

  // Rebuilt only when the inputs change, so the pseudo-random layout is stable
  // for a given slide rather than reshuffling on every render.
  const { drawn, safeLabels } = useMemo(() => {
    const list = labelKey.split('|');
    const rand = seedFrom(seedKey + kind + labelKey);
    const cls: Cls = (name) => (animate ? name : '');
    const Renderer = RENDERERS[kind];
    return { drawn: <Renderer labels={list} rand={rand} cls={cls} />, safeLabels: list };
  }, [kind, seedKey, labelKey, animate]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${kind} diagram: ${safeLabels.join(', ')}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {drawn}
    </svg>
  );
}
