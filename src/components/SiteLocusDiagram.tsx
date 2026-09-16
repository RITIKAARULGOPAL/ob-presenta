'use client';

import { useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { imageStyle } from '@/lib/imageTransform';
import type { Slide } from '@/types/slide';

/** Site-location hover-reveal: a locus map that reveals a building-elevation
 *  photo (with a floor-highlight caption and address) on hover/tap, paired
 *  with a compass/sun-path diagram whose sun-glow only appears while the
 *  reveal is active — one shared `isRevealed` boolean drives both sibling
 *  cards, rather than depending on CSS `:hover ~` sibling selectors. */
export function SiteLocusDiagram({ slide, editable }: { slide: Slide; editable: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  const [isRevealed, setIsRevealed] = useState(false);
  const f = slide.fields;

  function urlInput(value: string | undefined, placeholder: string, onChange: (v: string) => void) {
    if (!editable) return null;
    return (
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/40"
      />
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-6">
      {/* Left: locus map -> reveal photo */}
      <div
        className="relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg bg-black/30"
        onMouseEnter={() => setIsRevealed(true)}
        onMouseLeave={() => setIsRevealed(false)}
        onClick={() => setIsRevealed((v) => !v)}
      >
        {f.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
        )}
        {!f.imageUrl && !editable && <span className="flex h-full items-center justify-center text-sm text-white/40">Site map</span>}

        {/* Reveal layer */}
        <div
          className={`absolute inset-0 flex flex-col justify-end bg-black/50 p-4 transition-opacity duration-500 ${
            isRevealed ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {f.revealImageUrl && (
            <div className="site-shimmer absolute inset-0 -z-10 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.revealImageUrl} alt="" style={imageStyle(f.revealImageTransform)} className="h-full w-full object-cover" />
            </div>
          )}
          <span className="w-fit rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
            {f.revealLabel || (editable ? 'Floor label' : '')}
          </span>
          <EditableText
            editable={editable}
            value={f.address ?? ''}
            onChange={(v) => updateField('address', v)}
            as="p"
            placeholder="Site address"
            className="mt-1 text-[11px] text-white/85 outline-none"
          />
        </div>

        {editable && (
          <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            {urlInput(f.imageUrl, 'Paste map image URL…', (v) => updateField('imageUrl', v))}
            {urlInput(f.revealImageUrl, 'Paste reveal photo URL…', (v) => updateField('revealImageUrl', v))}
            <EditableText
              editable={editable}
              value={f.revealLabel ?? ''}
              onChange={(v) => updateField('revealLabel', v)}
              as="div"
              placeholder="Floor label, e.g. 10th Floor"
              className="rounded-md border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-white outline-none"
            />
          </div>
        )}
      </div>

      {/* Right: compass / sun-path */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black/30">
        {f.compassImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.compassImageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          !editable && <span className="flex h-full items-center justify-center text-sm text-white/40">Compass</span>
        )}
        <div className="site-sun-orbit absolute inset-0">
          <div className={`site-sun ${isRevealed ? 'glow' : ''}`} />
        </div>
        {editable && (
          <div className="absolute inset-x-2 bottom-2">
            {urlInput(f.compassImageUrl, 'Paste compass/sun-path image URL…', (v) => updateField('compassImageUrl', v))}
          </div>
        )}
      </div>
    </div>
  );
}
