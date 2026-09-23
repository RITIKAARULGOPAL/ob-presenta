/** A tiny, always-looping, purely decorative demo of the Burst vs. Fade
 *  split/merge style — generic placeholder shapes, never real hotspot data
 *  or the real shapeMorph.ts engine. Exists so the two styles can be told
 *  apart before any real zone/rooms are drawn on a view, per the user's own
 *  framing of "give a preview" as a style comparison, not a live rehearsal.
 *  Looping is pure CSS (`globals.css`'s `ss-*` keyframes) — no JS timer, no
 *  React state, nothing to clean up. */
export function SplitStylePreviewIcon({ variant }: { variant: 'burst' | 'fade' }) {
  // Three "room" targets fanning out from one "zone" on the left — same
  // final layout for both variants, so the only real difference on screen
  // is whether the rooms share a starting point (burst) or not (fade).
  const rooms = [
    { x: 68, y: 14 },
    { x: 70, y: 30 },
    { x: 68, y: 46 },
  ];
  const zone = { x: 26, y: 30 };

  return (
    <svg viewBox="0 0 100 60" className="h-6 w-10" aria-hidden="true">
      {variant === 'burst' ? (
        <>
          <circle className="ss-zone fill-[var(--accent)]" cx={zone.x} cy={zone.y} r={11} opacity={0.35} />
          {rooms.map((r, i) => (
            <rect
              key={i}
              className="ss-burst-room fill-[var(--accent)]"
              x={r.x - 5}
              y={r.y - 5}
              width={10}
              height={10}
              rx={2}
              style={{
                // Offset from this room's own resting spot back to the
                // shared zone centre — the keyframe animates *away* from
                // this (translate(0,0) at rest), so every room's path
                // converges on the same point regardless of where it ends.
                ['--ss-x' as string]: `${zone.x - r.x}px`,
                ['--ss-y' as string]: `${zone.y - r.y}px`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </>
      ) : (
        <>
          <circle className="ss-fade-el fill-[var(--accent)]" cx={zone.x} cy={zone.y} r={11} opacity={0.35} style={{ animationDelay: '0s' }} />
          {rooms.map((r, i) => (
            <rect
              key={i}
              className="ss-fade-el fill-[var(--accent)]"
              x={r.x - 5}
              y={r.y - 5}
              width={10}
              height={10}
              rx={2}
              style={{ animationDelay: `${0.3 + i * 0.22}s` }}
            />
          ))}
        </>
      )}
    </svg>
  );
}
