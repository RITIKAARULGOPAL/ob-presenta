'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** The chrome's buttons, in one place.
 *
 *  Before this, every button in the app was a bespoke Tailwind string — which
 *  is how the same control ended up 28px tall in one place and 34px in
 *  another, with three different radii. The variants here are the whole
 *  vocabulary: if a new button does not fit one, that is a design decision to
 *  make deliberately, not a new class string to improvise.
 *
 *  Slide-surface controls are NOT built from these. A slide paints from its
 *  own --ink/--line/--accent scope and is what gets exported; the chrome's
 *  tokens have no business inside it. */

type Variant = 'primary' | 'raised' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const VARIANT: Record<Variant, string> = {
  // The one blue button on screen. More than one and neither is primary.
  primary: 'border-ui-accent bg-ui-accent text-ui-accent-on hover:bg-ui-accent-hover',
  // A control with a visible edge — the default for anything that opens a menu.
  raised: 'border-ui-line bg-ui-raised text-ui-ink hover:bg-ui-raised-hover',
  // Sits in a toolbar and only shows its shape on hover.
  ghost: 'border-transparent bg-transparent text-ui-ink-2 hover:bg-ui-raised hover:text-ui-ink',
  // Muted at rest, red on approach. A permanently red delete is the loudest
  // thing in a toolbar, which is backwards for its most destructive control.
  danger: 'border-transparent bg-transparent text-ui-ink-3 hover:bg-ui-danger-soft hover:text-ui-danger',
};

// 32px is the standard target and 28px the compact one. Both are deliberate
// desktop-tool densities: this is a pointer-driven editor, not a touch app.
const SIZE: Record<Size, string> = {
  md: 'h-8 gap-1.5 px-2.5 text-ctl',
  sm: 'h-7 gap-1.5 px-2 text-label',
};

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-ui-sm border font-medium ' +
  'transition-colors duration-150 ease-ui disabled:pointer-events-none disabled:opacity-40';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Rendered before the label, already sized. */
  icon?: ReactNode;
  /** A chevron after the label, for anything that opens a menu. */
  trailing?: ReactNode;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  trailing,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {icon}
      {children}
      {trailing}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Required: an icon alone says nothing to a screen reader, and doubles as
   *  the tooltip/title for everyone else. */
  label: string;
  icon: ReactNode;
  /** Drawn as held-down — a toggle that is currently on. */
  active?: boolean;
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  icon,
  active = false,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const on = active ? 'bg-ui-raised text-ui-ink' : '';
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={`${BASE} ${VARIANT[variant]} ${box} p-0 ${on} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}

/** A hairline between groups of controls in a toolbar. */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ui-line" />;
}
