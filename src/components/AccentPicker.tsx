'use client';

import { useEffect, useState } from 'react';
import { extractAccentColors } from '@/lib/color';

const DEFAULT_ACCENT = '#0b72c2';

/** Offers accent colours pulled out of a logo, plus a manual colour input.
 * Used both when setting a project up and later from the editor, so the two
 * places stay in step.
 *
 * Extraction results are stored keyed by the logo they came from, so the
 * loading/empty states can be derived during render — no state-syncing effect,
 * only the async extraction itself lives in one. */
export function AccentPicker({
  logo,
  value,
  onChange,
  tone = 'light',
}: {
  logo?: string;
  value?: string;
  onChange: (hex: string | undefined) => void;
  tone?: 'light' | 'panel';
}) {
  const [result, setResult] = useState<{ logo: string; colors: string[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const matched = logo && result && result.logo === logo ? result : null;
  const settled = !!matched || (!!logo && failedFor === logo);

  useEffect(() => {
    if (!logo || settled) return;
    let cancelled = false;
    extractAccentColors(logo)
      .then((colors) => {
        if (!cancelled) setResult({ logo, colors });
      })
      .catch((err) => {
        console.error('Could not read colours from the logo:', err);
        if (!cancelled) setFailedFor(logo);
      });
    return () => {
      cancelled = true;
    };
  }, [logo, settled]);

  const swatches = matched?.colors ?? [];
  const reading = !!logo && !settled;
  const noneFound = !!logo && settled && swatches.length === 0;

  const labelTone = tone === 'panel' ? 'text-slate-400' : 'text-slate-500';
  const active = value ?? DEFAULT_ACCENT;

  return (
    <div>
      {reading && <p className={`mb-1.5 text-[11px] ${labelTone}`}>Reading colours from the logo…</p>}
      {noneFound && (
        <p className={`mb-1.5 text-[11px] ${labelTone}`}>That logo is black and white — no accent to pull. Set one manually below.</p>
      )}

      {swatches.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              title={hex}
              style={{ backgroundColor: hex }}
              className={`h-7 w-7 rounded-full border-2 transition ${
                active.toLowerCase() === hex.toLowerCase() ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white shadow-sm hover:scale-110'
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={active}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
        />
        <span className={`font-mono text-[11px] ${labelTone}`}>{active}</span>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className={`text-[11px] font-medium hover:text-red-500 ${labelTone}`}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
