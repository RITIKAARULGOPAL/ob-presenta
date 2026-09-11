'use client';

import { createElement, useEffect, useRef } from 'react';

type Tag = 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'span';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  as?: Tag;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  editable?: boolean;
}

/** A contentEditable element kept in sync with external state without fighting
 * the cursor: it only overwrites the DOM's text when the value changed from
 * OUTSIDE (e.g. switching slides) and the element isn't currently focused.
 * Commits back to the store on blur, not on every keystroke — typing stays
 * fully native, no React re-render fights the caret position mid-edit.
 *
 * Built with createElement + a narrow `Tag` union (not JSX on a computed
 * `keyof JSX.IntrinsicElements`) — the latter makes TypeScript try to union
 * every intrinsic element's prop types at once, which blows past its
 * complexity limit for a component with this many event/ref props. */
export function EditableText({
  value,
  onChange,
  as = 'div',
  className,
  style,
  placeholder,
  editable = true,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);

  // An unfilled field is nothing to show. In Presenter and in an export the
  // element drops out entirely rather than reserving an empty line, which is
  // what lets a slide default to empty (slideDefaults.ts) without leaving
  // holes in front of an audience.
  const blank = !value.trim();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  if (!editable && blank) return null;

  // Forwarding `ref` through createElement's props is the standard way to attach a ref to a
  // dynamically-chosen tag; nothing here reads ref.current during render, only inside the
  // effect above and the onBlur handler below.
  // eslint-disable-next-line react-hooks/refs
  return createElement(as, {
    ref,
    contentEditable: editable,
    suppressContentEditableWarning: true,
    className,
    style,
    // Editor-only, so a hint can never reach a rendered deck.
    'data-placeholder': editable ? placeholder : undefined,
    onBlur: (e: React.FocusEvent<HTMLElement>) => onChange(e.currentTarget.textContent ?? ''),
  });
}
