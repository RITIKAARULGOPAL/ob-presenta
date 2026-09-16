'use client';

import { useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { fileToSlideImage } from '@/lib/imageFile';
import type { OrbitNode, Slide } from '@/types/slide';

/** One node's fixed position on the ring, evenly spaced — same angle formula
 *  ConceptDiagram's Radial/Nodes renderers already use, just in CSS percentage
 *  space instead of an SVG viewBox. */
function nodePosition(i: number, count: number): { left: string; top: string } {
  const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
  const radius = 42; // % of the stage's own box
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius * 0.82}%`, // slightly flattened, matches a 16:9 stage better than a true circle
  };
}

function OrbitNodeDot({
  node,
  angleIndex,
  count,
  editable,
  hovered,
  onHover,
  onChangeLabel,
  onChangeImage,
  onRemove,
}: {
  node: OrbitNode;
  angleIndex: number;
  count: number;
  editable: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onChangeLabel: (label: string) => void;
  onChangeImage: (url: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pos = nodePosition(angleIndex, count);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChangeImage(await fileToSlideImage(file));
    } catch (err) {
      console.error('Could not read that image:', err);
    }
    setBusy(false);
  }

  return (
    <div
      className="orbit-node-counter group/orb absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={pos}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        onClick={() => editable && fileRef.current?.click()}
        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 bg-[var(--accent-soft)] shadow-sm transition ${
          hovered ? 'border-[var(--accent)] scale-110' : 'border-white'
        } ${editable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[var(--accent)]">
            {busy ? '…' : node.label ? node.label.slice(0, 2).toUpperCase() : '+'}
          </span>
        )}
      </button>
      {editable && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="absolute h-px w-px overflow-hidden opacity-0"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void pick(file);
          }}
        />
      )}
      <EditableText
        editable={editable}
        value={node.label}
        onChange={onChangeLabel}
        as="span"
        placeholder="Label"
        className="max-w-[6rem] text-center text-[11px] font-semibold leading-tight text-[var(--ink)] outline-none"
      />
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[9px] font-semibold text-[var(--ink-3)] opacity-0 hover:text-red-500 group-hover/orb:opacity-100"
        >
          Remove
        </button>
      )}
    </div>
  );
}

/** A rotating persona/value diagram: a fixed core with N labeled, photo-able
 *  nodes orbiting it. Hovering a node swaps the core's own text to that
 *  node's; the whole ring pauses while hovered so the swapped text stays
 *  readable, then resumes. CSS-only rotation (respects prefers-reduced-motion
 *  globally, see globals.css) — the only JS state is which node is hovered. */
export function OrbitDiagram({ slide, editable }: { slide: Slide; editable: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  const addOrbitNode = useEditorStore((s) => s.addOrbitNode);
  const removeOrbitNode = useEditorStore((s) => s.removeOrbitNode);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodes = slide.fields.orbitNodes ?? [];
  const hovered = nodes.find((n) => n.id === hoveredId);

  function setNode(id: string, patch: Partial<OrbitNode>) {
    updateField('orbitNodes', nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  return (
    <div className="relative mx-auto mt-6 aspect-video w-full max-w-2xl">
      <div className={`orbit-ring absolute inset-0 ${hoveredId ? 'paused' : ''}`}>
        {nodes.map((node, i) => (
          <OrbitNodeDot
            key={node.id}
            node={node}
            angleIndex={i}
            count={nodes.length}
            editable={editable}
            hovered={hoveredId === node.id}
            onHover={setHoveredId}
            onChangeLabel={(label) => setNode(node.id, { label })}
            onChangeImage={(imageUrl) => setNode(node.id, { imageUrl })}
            onRemove={() => removeOrbitNode(node.id)}
          />
        ))}
      </div>

      {/* The core sits outside the rotating ring so it never spins itself. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-dashed border-[var(--accent-soft-line)] bg-white px-3 text-center shadow-sm">
        <EditableText
          editable={editable && !hovered}
          value={hovered ? hovered.label : slide.fields.orbitCoreTitle ?? ''}
          onChange={(v) => updateField('orbitCoreTitle', v)}
          as="div"
          placeholder="Core title"
          className="pointer-events-auto font-display text-sm font-bold leading-tight text-[var(--accent)] outline-none"
        />
        {!hovered && (
          <EditableText
            editable={editable}
            value={slide.fields.orbitCoreBody ?? ''}
            onChange={(v) => updateField('orbitCoreBody', v)}
            as="div"
            placeholder="Hover a node…"
            className="pointer-events-auto mt-1 text-[10px] leading-snug text-[var(--ink-3)] outline-none"
          />
        )}
      </div>

      {editable && (
        <button
          type="button"
          onClick={addOrbitNode}
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-md border border-dashed border-[var(--line)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          + Node
        </button>
      )}
    </div>
  );
}
