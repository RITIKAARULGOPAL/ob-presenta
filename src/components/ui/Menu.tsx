'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** A dropdown menu, replacing the hand-rolled ones that were inlined in the
 *  editor page — each of which had its own open state, its own absolute
 *  positioning, and no way to close on Escape or on a click elsewhere.
 *
 *  Closing is handled here once: Escape, a pointer down outside, or choosing
 *  an item. Focus returns to the trigger on Escape so the keyboard does not
 *  get stranded. */

export function Menu({
  trigger,
  children,
  align = 'end',
  width = 'w-52',
}: {
  /** Given `open`, so the caller can draw the trigger as pressed. */
  trigger: (props: { open: boolean; onClick: () => void; id: string; 'aria-expanded': boolean }) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      wrapRef.current?.querySelector('button')?.focus();
    }
    // Capture phase, like Lightbox/SpaceDetailOverlay already do: Presenter
    // and the editor both listen for Escape on window, and without this one
    // keypress would close the menu AND act on the deck underneath.
    addEventListener('pointerdown', onPointerDown);
    addEventListener('keydown', onKey, true);
    return () => {
      removeEventListener('pointerdown', onPointerDown);
      removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {trigger({ open, onClick: () => setOpen((v) => !v), id, 'aria-expanded': open })}
      {open && (
        <div
          role="menu"
          aria-labelledby={id}
          onClick={() => setOpen(false)}
          className={`absolute top-[calc(100%+6px)] z-30 ${width} ${align === 'end' ? 'right-0' : 'left-0'} rounded-ui-md border border-ui-line bg-ui-surface p-1 shadow-float`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  selected = false,
  tone = 'default',
}: {
  icon?: ReactNode;
  children: ReactNode;
  /** Right-aligned shortcut or status text. */
  hint?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  tone?: 'default' | 'accent';
}) {
  const col = tone === 'accent' ? 'text-ui-accent' : 'text-ui-ink-2';
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-ui-sm px-2.5 py-1.5 text-left text-ctl font-medium ${col} transition-colors duration-150 ease-ui hover:bg-ui-raised hover:text-ui-ink`}
    >
      {icon && <span className="flex shrink-0 text-ui-ink-3">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <span className="shrink-0 text-ui-accent">✓</span>}
      {hint && <span className="shrink-0 text-micro text-ui-ink-3">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-micro font-bold uppercase tracking-wider text-ui-ink-3">{children}</div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-ui-line-soft" />;
}

/** A keyboard shortcut chip. Shortcuts already exist all over the editor and
 *  were only ever mentioned in a footer hint; this is how they get shown
 *  where the action is. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] items-center rounded-[4px] border border-ui-line bg-ui-raised px-1 font-sans text-[10px] font-semibold text-ui-ink-3">
      {children}
    </kbd>
  );
}
