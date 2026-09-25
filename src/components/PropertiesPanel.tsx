'use client';

import { useRef, useState } from 'react';
import { useEditorStore } from '@/lib/editorStore';
import { AccentPicker } from './AccentPicker';
import { FONT_PAIRINGS, TYPE_SCALES, HEADLINE_WEIGHTS, BODY_FONTS, TRACKINGS } from '@/lib/fonts';
import { fileToSlideImage } from '@/lib/imageFile';
import { IconImage, IconLink, IconDroplet, IconType, IconLayers, IconCompass, IconChevronDown, IconChevronRight, SECTION_ICONS, IconSectionDefault } from './icons';
import type { Brand, SectionIconKey } from '@/types/slide';
import { LINKED_VIEW_DRAW_TOOLS } from './SlideRenderer';

type SectionKey = 'designOption' | 'sectionIcon' | 'background' | 'logo' | 'linkedSlides' | 'accent' | 'typography';

/** One collapsible section — a header row (icon + label + chevron) toggling
 *  its own content. Local to this panel: every section here follows the
 *  same shape, and nothing else in the app needs this pattern (yet). Kept
 *  collapsed by default and opened only when the panel decides a section
 *  already holds a real value, so an empty/untouched slide's panel reads as
 *  a short, scannable list of headers instead of a wall of always-expanded
 *  controls and permanent explanatory paragraphs. */
function Disclosure({
  icon,
  label,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 border-b border-ui-line-soft pb-2 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wide text-ui-ink-3 transition hover:text-ui-ink-2"
      >
        {icon} {label}
        <span className="ml-auto text-ui-ink-3">
          {open ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <div className="pb-4 pt-1">{children}</div>}
    </div>
  );
}

const SECTION_ICON_ORDER: SectionIconKey[] = ['file', 'list', 'bulb', 'grid', 'star', 'layers', 'users', 'wallet', 'compass', 'trending'];

const BRAND_OPTIONS: { key: Brand | 'default'; label: string }[] = [
  { key: 'default', label: 'Project default' },
  { key: 'skv', label: 'SKV' },
  { key: 'ob', label: 'OB' },
  { key: 'both', label: 'Both' },
];

/** One row of "Project default" plus that axis's presets — the same
 *  pattern Logo & Copyright already uses, just generic across the four
 *  typography axes instead of one brand value. `value` is the slide's own
 *  override for this axis (undefined = inheriting the project's setting). */
function TypeAxisRow<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: K; label: string }[];
  value: K | undefined;
  onChange: (key: K | undefined) => void;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(undefined)}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
            value === undefined ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-3 hover:border-ui-line-strong'
          }`}
        >
          Default
        </button>
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
              value === o.key ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-3 hover:border-ui-line-strong'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const slide = useEditorStore((s) => s.currentSlide());
  const project = useEditorStore((s) => s.project);
  const setBrandOverride = useEditorStore((s) => s.setBrandOverride);
  const setDesignOption = useEditorStore((s) => s.setDesignOption);
  const setSectionIcon = useEditorStore((s) => s.setSectionIcon);
  const setAccentColor = useEditorStore((s) => s.setAccentColor);
  const setSlideTypographyOverride = useEditorStore((s) => s.setSlideTypographyOverride);
  const setLinkedSlideIds = useEditorStore((s) => s.setLinkedSlideIds);
  const setSlideBackground = useEditorStore((s) => s.setSlideBackground);
  const resetSlideBackground = useEditorStore((s) => s.resetSlideBackground);
  const linkedViewToolbar = useEditorStore((s) => s.linkedViewToolbar);
  const bgFileRef = useRef<HTMLInputElement>(null);
  // Defaults open (unlike the other sections below) — there's no "already
  // has a value" concept for a live tool-selector the way there is for
  // e.g. Background, so "present at all = relevant right now" is the more
  // useful default. Not slide-keyed since it isn't part of `SectionKey`.
  const [toolbarOpen, setToolbarOpen] = useState(true);

  const linkedIds = slide?.fields.linkedSlideIds ?? [];
  // Plans, renders and design slides are what a concept wants to point at —
  // linking one body-copy slide to another isn't the useful case.
  const linkTargets = (project?.slides ?? []).filter(
    (s) => s.id !== slide?.id && (s.layout === 'linked-views' || s.style === 'design'),
  );

  // Which sections start open for *this* slide — collapsed by default,
  // except a section that already holds a real value, so an active
  // customization stays visible without hunting for it. Keyed by slide.id
  // and recomputed via the "adjust state during render via a ref-compared
  // key" pattern (not a useEffect) whenever the selected slide changes, so
  // switching slides always reflects that slide's own values rather than
  // whatever was left open on the last one.
  const initialOpen = (): Record<SectionKey, boolean> => ({
    designOption: !!slide?.designOption,
    sectionIcon: !!slide?.sectionIcon,
    background: !!(slide?.background?.color || slide?.background?.imageUrl),
    logo: slide?.brandOverride !== undefined,
    linkedSlides: linkedIds.length > 0,
    accent: !!project?.accentColor,
    typography: !!(
      slide?.typographyOverride &&
      (slide.typographyOverride.font !== undefined ||
        slide.typographyOverride.scale !== undefined ||
        slide.typographyOverride.weight !== undefined ||
        slide.typographyOverride.bodyFont !== undefined ||
        slide.typographyOverride.tracking !== undefined)
    ),
  });
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(initialOpen);
  const [openForSlideId, setOpenForSlideId] = useState(slide?.id);
  if (slide && slide.id !== openForSlideId) {
    setOpenForSlideId(slide.id);
    setOpen(initialOpen());
  }
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  if (!slide) return null;

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-ui-line bg-ui-surface px-5 py-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ui-accent">Slide</div>
      <div className="mb-6 font-chrome-display text-base font-bold tracking-tight text-ui-ink">Properties</div>

      {/* The active Linked Views slide's canvas toolbar (Zoom/pan, North,
          Calibrate, drawing tools) — moved off the slide canvas per direct
          feedback ("these tools can come in properties panel in a separate
          tool bar"). `linkedViewToolbar` is registered live by
          LinkedViewsExplorer (SlideRenderer.tsx) — see the registration
          effect there — and is null whenever no Linked Views slide with an
          image loaded is currently selected, so this section simply isn't
          rendered otherwise. Placed above every other section: this is the
          slide's primary editing-mode toolbar, not a per-slide setting. */}
      {linkedViewToolbar && (
        <Disclosure
          icon={<IconCompass className="h-3.5 w-3.5" />}
          label="Linked View Tools"
          open={toolbarOpen}
          onToggle={() => setToolbarOpen((o) => !o)}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <label
              className="flex items-center gap-1 text-[11px] font-medium text-ui-ink-3"
              title="Lets viewers wheel-zoom and drag-pan this image (Presenter/view mode only)"
            >
              <input
                type="checkbox"
                checked={linkedViewToolbar.zoomPanEnabled}
                onChange={(e) => linkedViewToolbar.onToggleZoomPan(e.target.checked)}
                className="accent-ui-accent"
              />
              Zoom/pan
            </label>
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ui-line" />
            <button
              onPointerDown={linkedViewToolbar.onNorthPointerDown}
              onPointerMove={linkedViewToolbar.onNorthPointerMove}
              onPointerUp={linkedViewToolbar.onNorthPointerUp}
              title={
                linkedViewToolbar.northLocked
                  ? `North: ${Math.round(linkedViewToolbar.displayNorthDeg)}° — locked, unlock to drag`
                  : `North: ${Math.round(linkedViewToolbar.displayNorthDeg)}° — drag to rotate`
              }
              style={{ transform: `rotate(${linkedViewToolbar.displayNorthDeg}deg)` }}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-ui-ink-3 outline-none [touch-action:none] ${
                linkedViewToolbar.northLocked
                  ? 'cursor-not-allowed border-ui-line opacity-50'
                  : 'cursor-grab border-ui-line hover:border-ui-accent hover:text-ui-accent active:cursor-grabbing'
              }`}
            >
              <svg viewBox="0 0 40 40" className="h-full w-full">
                <circle cx="20" cy="21" r="17" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" />
                <line x1="20" y1="31" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 12 L24 19 L20 16.5 L16 19 Z" fill="currentColor" />
              </svg>
            </button>
            {linkedViewToolbar.northLocked && (
              <button
                onClick={linkedViewToolbar.onUnlockNorth}
                title="Unlock to drag North again"
                className="rounded-full border border-ui-line px-2 py-1 text-[11px] font-medium text-ui-ink-3 hover:border-ui-ink-3"
              >
                🔒 Unlock
              </button>
            )}
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ui-line" />
            {linkedViewToolbar.hasCalibration ? (
              <>
                <button
                  onClick={linkedViewToolbar.onCalibrate}
                  disabled={linkedViewToolbar.calibrationLocked}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    linkedViewToolbar.calibrationLocked
                      ? 'cursor-not-allowed border-ui-line text-ui-ink-3 opacity-50'
                      : 'border-ui-line text-ui-ink-3 hover:border-ui-ink-3'
                  }`}
                >
                  Recalibrate
                </button>
                {linkedViewToolbar.calibrationLocked && (
                  <button
                    onClick={linkedViewToolbar.onUnlockCalibration}
                    title="Unlock to recalibrate"
                    className="rounded-full border border-ui-line px-2 py-1 text-[11px] font-medium text-ui-ink-3 hover:border-ui-ink-3"
                  >
                    🔒 Unlock
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={linkedViewToolbar.onCalibrate}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  linkedViewToolbar.pickMode === 'calibrate'
                    ? 'border-ui-accent bg-ui-accent-soft text-ui-accent'
                    : 'border-ui-accent-line bg-ui-accent-soft text-ui-accent'
                }`}
              >
                {linkedViewToolbar.pickMode === 'calibrate' ? 'Click two points a known distance apart' : 'Calibrate'}
              </button>
            )}
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ui-line" />
            {LINKED_VIEW_DRAW_TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => linkedViewToolbar.onSetTool(t.key)}
                title={t.hint}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  linkedViewToolbar.tool === t.key
                    ? 'border-ui-accent bg-ui-accent-soft text-ui-accent'
                    : 'border-dashed border-ui-line text-ui-ink-2 hover:border-ui-accent hover:text-ui-accent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Disclosure>
      )}

      {/* One project can carry several design options (e.g. "Option 1",
          "Scheme West") as ordinary Concept/Layout/Render slides tagged with
          the same free-text label — not a new slide type, just a shared tag,
          the same convention ViewHotspot.zoneCategory already uses. Placed
          above Background/Layout/Style: it groups slides across the whole
          deck, so it reads as the most structural thing on this panel. */}
      <Disclosure
        icon={<IconLayers className="h-3.5 w-3.5" />}
        label="Design Option"
        open={open.designOption}
        onToggle={() => toggle('designOption')}
      >
        <input
          value={slide.designOption ?? ''}
          onChange={(e) => setDesignOption(e.target.value.trim() || undefined)}
          placeholder="e.g. Option 1, Scheme West"
          title="Groups this slide with others tagged the same — a Concept, Layout and Renders for one design option. Leave blank for a slide that doesn't belong to any option."
          list="design-options"
          className="w-full rounded-md border border-ui-line px-2.5 py-1.5 text-xs outline-none focus:border-ui-accent"
        />
        {/* Existing options offered as suggestions, so a second "Option 1" is
            one keystroke rather than a near-miss like "option 1 ". */}
        <datalist id="design-options">
          {[...new Set((project?.slides ?? []).map((s) => s.designOption?.trim()).filter(Boolean))].map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Disclosure>

      {/* Only meaningful once this slide is a section-starter — that's what
          makes it a divider Presenter's sidebar lists as its own section.
          Sits right below Design Option since that's the same "groups
          across the deck" register, and right above where Slide Style is
          set (the toolbar menu, not this panel) so an author sees it the
          moment the style they just picked makes it relevant. */}
      {slide.style === 'section-starter' && (
        <Disclosure
          icon={<IconLayers className="h-3.5 w-3.5" />}
          label="Section Icon"
          open={open.sectionIcon}
          onToggle={() => toggle('sectionIcon')}
        >
          <p className="mb-2.5 text-[11px] leading-relaxed text-ui-ink-3">Shown next to this section in Presenter&apos;s sidebar.</p>
          <div className="flex flex-wrap gap-1.5">
            {SECTION_ICON_ORDER.map((key) => {
              const Icon = SECTION_ICONS[key];
              const active = slide.sectionIcon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSectionIcon(active ? undefined : key)}
                  title={key}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
                    active ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-3 hover:border-ui-line-strong'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          {!slide.sectionIcon && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-ui-ink-3">
              <IconSectionDefault className="h-3.5 w-3.5 shrink-0" /> No icon picked yet — this default shows until you pick one.
            </p>
          )}
        </Disclosure>
      )}

      {/* Slide Style and Slide Layout used to live here as 18 always-visible
          pills. They are menu triggers in the editor toolbar now — one line
          that says what is set, instead of a grid that never changes. */}
      <Disclosure
        icon={<IconDroplet className="h-3.5 w-3.5" />}
        label="Background"
        open={open.background}
        onToggle={() => toggle('background')}
      >
        <div
          className="flex items-center gap-2"
          title="Replaces this slide's default background. Text colour doesn't auto-adjust — pick a Section Starter/Design style for light text on a dark background."
        >
          <label
            title="Background colour"
            className="relative h-7 w-7 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-ui-line"
            style={{ backgroundColor: slide.background?.color ?? '#ffffff' }}
          >
            <input
              type="color"
              value={slide.background?.color ?? '#ffffff'}
              onChange={(e) => setSlideBackground({ color: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="absolute h-px w-px overflow-hidden opacity-0"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setSlideBackground({ imageUrl: await fileToSlideImage(file) });
            }}
          />
          <button
            onClick={() => bgFileRef.current?.click()}
            className="rounded-md border border-ui-line px-2.5 py-1.5 text-xs font-medium text-ui-ink-2 transition hover:border-ui-line-strong"
          >
            {slide.background?.imageUrl ? 'Replace image' : 'Choose image'}
          </button>
          {(slide.background?.color || slide.background?.imageUrl) && (
            <button
              onClick={resetSlideBackground}
              className="ml-auto text-[11px] font-medium text-ui-ink-3 hover:text-ui-ink-2"
            >
              Reset
            </button>
          )}
        </div>
        {slide.background?.imageUrl && (
          <div className="mt-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ui-ink-3">
              Image darken (for text legibility)
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={slide.background.imageOpacity ?? 0}
              onChange={(e) => setSlideBackground({ imageOpacity: Number(e.target.value) })}
              className="w-full accent-ui-accent"
            />
          </div>
        )}
      </Disclosure>

      <Disclosure
        icon={<IconImage className="h-3.5 w-3.5" />}
        label="Logo & Copyright"
        open={open.logo}
        onToggle={() => toggle('logo')}
      >
        <div className="flex flex-wrap gap-2">
          {BRAND_OPTIONS.map((o) => {
            const selected = o.key === 'default' ? slide.brandOverride === undefined : slide.brandOverride === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setBrandOverride(o.key === 'default' ? undefined : o.key)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                  selected ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-2 hover:border-ui-line-strong'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Disclosure>

      <Disclosure
        icon={<IconLink className="h-3.5 w-3.5" />}
        label="Linked Slides"
        open={open.linkedSlides}
        onToggle={() => toggle('linkedSlides')}
      >
        {linkTargets.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-ui-ink-3">
            Add a Linked Views or Design slide to link one here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkTargets.map((target) => {
              const on = linkedIds.includes(target.id);
              return (
                <label
                  key={target.id}
                  className="flex cursor-pointer items-center gap-2"
                  title="Shows as a chip on this slide — click it in Presenter to jump there"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setLinkedSlideIds(on ? linkedIds.filter((id) => id !== target.id) : [...linkedIds, target.id])
                    }
                    className="accent-ui-accent"
                  />
                  <span className="truncate text-[12px] text-ui-ink-2">{target.fields.title || 'Untitled slide'}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase text-ui-ink-3">
                    {target.layout === 'linked-views' ? 'views' : target.style === 'design' ? 'design' : 'slide'}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Disclosure>

      <Disclosure
        icon={<IconDroplet className="h-3.5 w-3.5" />}
        label="Accent Colour"
        open={open.accent}
        onToggle={() => toggle('accent')}
      >
        <AccentPicker logo={project?.clientLogo} value={project?.accentColor} onChange={setAccentColor} tone="panel" />
      </Disclosure>

      <Disclosure
        icon={<IconType className="h-3.5 w-3.5" />}
        label="Typography"
        open={open.typography}
        onToggle={() => toggle('typography')}
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSlideTypographyOverride({ font: undefined })}
            title="Inherit the project's own headline face"
            className={`flex flex-col items-center gap-1 rounded-md border px-3 py-1.5 transition ${
              slide.typographyOverride?.font === undefined
                ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent'
                : 'border-ui-line text-ui-ink-2 hover:border-ui-line-strong'
            }`}
          >
            <span className="text-lg leading-none text-ui-ink-3">—</span>
            <span className="text-[10px] font-medium">Default</span>
          </button>
          {FONT_PAIRINGS.map((f) => {
            const selected = slide.typographyOverride?.font === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setSlideTypographyOverride({ font: f.key })}
                title={f.label}
                className={`flex flex-col items-center gap-1 rounded-md border px-3 py-1.5 transition ${
                  selected ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line text-ui-ink-2 hover:border-ui-line-strong'
                }`}
              >
                <span style={{ fontFamily: f.cssVar }} className="text-lg font-bold leading-none">
                  {f.sample}
                </span>
                <span className="text-[10px] font-medium">{f.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-ui-line-soft pt-4">
          <TypeAxisRow
            label="Size"
            options={TYPE_SCALES.map((s) => ({ key: s.key, label: s.label }))}
            value={slide.typographyOverride?.scale}
            onChange={(v) => setSlideTypographyOverride({ scale: v })}
          />
          <TypeAxisRow
            label="Weight"
            options={HEADLINE_WEIGHTS.map((w) => ({ key: w.key, label: w.label }))}
            value={slide.typographyOverride?.weight}
            onChange={(v) => setSlideTypographyOverride({ weight: v })}
          />
          <TypeAxisRow
            label="Body Font"
            options={BODY_FONTS.map((b) => ({ key: b.key, label: b.label }))}
            value={slide.typographyOverride?.bodyFont}
            onChange={(v) => setSlideTypographyOverride({ bodyFont: v })}
          />
          <TypeAxisRow
            label="Tracking"
            options={TRACKINGS.map((t) => ({ key: t.key, label: t.label }))}
            value={slide.typographyOverride?.tracking}
            onChange={(v) => setSlideTypographyOverride({ tracking: v })}
          />
        </div>
      </Disclosure>
    </aside>
  );
}
