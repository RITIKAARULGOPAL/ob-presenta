'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject, deleteProject, listProjects } from '@/lib/data';
import { fileToDataUrl } from '@/lib/imageFile';
import { useEditorStore } from '@/lib/editorStore';
import { AccentPicker } from '@/components/AccentPicker';
import { IconClose, IconSearch, IconTrash } from '@/components/icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { IconButton } from '@/components/ui/Button';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import type { Brand, ProjectSummary } from '@/types/slide';

const BRAND_CHOICES: { key: Brand; label: string; hint: string }[] = [
  { key: 'skv', label: 'SKV', hint: 'Studiokon Ventures' },
  { key: 'ob', label: 'OB', hint: 'Officebanao' },
  { key: 'both', label: 'Both', hint: 'Joint project' },
];

type SortKey = 'updated' | 'name' | 'date';

const BRAND_FILTER_OPTIONS: SegmentOption<Brand | 'all'>[] = [
  { key: 'all', label: 'All' },
  ...BRAND_CHOICES.map((c) => ({ key: c.key, label: c.label })),
];

const SORT_OPTIONS: SegmentOption<SortKey>[] = [
  { key: 'updated', label: 'Last edited' },
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Presentation date' },
];

/** `p.date` is a locale-formatted display string ("22 September 2026"), not
 *  an ISO value — parsed back to a timestamp only for sorting. An unparsable
 *  value sorts as epoch 0 (last under newest-first) rather than throwing. */
function parseProjectDate(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  // No longer collected on this form — `Project.client`/`preparedBy` are
  // still real, required fields elsewhere (the home list's "{client} ·
  // {date}" line, the editor header's "by {preparedBy}"), so they're kept
  // as fixed defaults here rather than removed from the data model.
  const client = '';
  const preparedBy = 'Officebanao';
  const [brand, setBrand] = useState<Brand>('ob');
  const [clientLogo, setClientLogo] = useState<string | undefined>();
  const [accentColor, setAccentColor] = useState<string | undefined>();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [date] = useState(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<Brand | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('updated');

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  const visibleProjects = projects
    .filter((p) => brandFilter === 'all' || p.brand === brandFilter)
    .filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return parseProjectDate(b.date) - parseProjectDate(a.date);
      return b.updatedAt - a.updatedAt;
    });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setError('');
    try {
      const project = await createProject({ name: name.trim(), client: client.trim(), preparedBy: preparedBy.trim(), date, brand, clientLogo, accentColor });
      // Preload the in-memory project (with the logo/accent we just picked) so the
      // editor's first render matches this form — its own fetch may come back
      // without them if the optional columns aren't in the database yet.
      useEditorStore.getState().loadProject(project);
      router.push(`/p/${project.id}/edit`);
    } catch (err) {
      // Navigating on a failed insert is what produced the dead
      // "Couldn't find that project." page — stay put and say what broke.
      setError(err instanceof Error ? `Couldn't create the presentation: ${err.message}` : "Couldn't create the presentation.");
    }
  }

  async function handleClientLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setClientLogo(await fileToDataUrl(file));
    } catch (err) {
      console.error('Could not read that logo file:', err);
    }
  }

  async function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
    await deleteProject(id);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero-bg px-6 py-16 text-hero-ink">
      {/* The backdrop wash changes with the theme too — same composition,
          different light — so it is a variable rather than a literal here. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--app-hero-glow)' }} />

      <ThemeToggle tone="hero" className="absolute right-6 top-6 z-10" />
      <div className="relative w-full max-w-3xl">
        {!showForm ? (
          <>
            <div className="mb-2 font-display text-4xl font-light tracking-[0.3em]">
              Presenta<span className="tracking-normal">.</span>
            </div>
            <p className="mb-1 text-lg font-medium text-hero-ink">An Interactive Presentation Platform</p>
            <p className="mb-3 max-w-md text-sm leading-relaxed text-hero-ink-2">
              Bringing clarity to every decision. Creating spaces that work, inspire and endure.
            </p>
            <p className="mb-14 text-sm text-hero-ink-3">Powered by Officebanao</p>

            <button
              onClick={() => setShowForm(true)}
              className="mb-10 flex w-full items-center gap-5 rounded-2xl border border-dashed border-hero-line-strong bg-hero-card p-7 text-left transition hover:bg-hero-card-hover"
            >
              <span className="flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-xl border border-hero-line bg-hero-card-hover p-3">
                <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-hero-ink" fill="none" strokeWidth={2} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span>
                <span className="block font-display text-lg font-bold">New presentation</span>
                <span className="block text-sm text-hero-ink-3">Start from a blank project — set the name and date</span>
              </span>
            </button>

            <div className="mb-4 text-xs font-bold uppercase tracking-widest text-hero-ink-2">Recent</div>
            {projects.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[180px] flex-1">
                  <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-hero-ink-3" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or client…"
                    className="w-full rounded-full border border-hero-line bg-hero-card py-1.5 pl-9 pr-4 text-sm text-hero-ink outline-none placeholder:text-hero-ink-3 focus:border-hero-line-strong"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl options={BRAND_FILTER_OPTIONS} value={brandFilter} onChange={setBrandFilter} ariaLabel="Filter by brand" tone="hero" />
                  <SegmentedControl options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} ariaLabel="Sort by" tone="hero" />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {projects.length === 0 && <div className="text-sm text-hero-ink-3">No saved presentations yet — start a new one above.</div>}
              {projects.length > 0 && visibleProjects.length === 0 && (
                <div className="text-sm text-hero-ink-3">No presentations match your filters.</div>
              )}
              {visibleProjects.map((p) => (
                <div
                  key={p.id}
                  data-project-id={p.id}
                  data-project-name={p.name}
                  className="flex items-center gap-4 rounded-xl border border-hero-line bg-hero-card px-6 py-5 transition hover:bg-hero-card-hover"
                >
                  <button onClick={() => router.push(`/p/${p.id}/edit`)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-ui-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-hero-ink">{p.name}</span>
                      <span className="block text-xs text-hero-ink-2">
                        {p.client ? `${p.client} · ` : ''}
                        {p.date}
                      </span>
                    </span>
                  </button>
                  {confirmDeleteId === p.id ? (
                    <span className="flex flex-shrink-0 items-center gap-3 text-xs font-semibold">
                      <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 text-ui-danger hover:text-ui-danger-ink">
                        <IconTrash className="h-3.5 w-3.5" /> Delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-hero-ink-3 hover:text-hero-ink">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="flex-shrink-0 text-hero-ink-3 hover:text-ui-danger"
                        aria-label={`Delete ${p.name}`}
                        title={`Delete ${p.name}`}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                      <button onClick={() => router.push(`/p/${p.id}/edit`)} className="flex-shrink-0 text-xs font-semibold text-hero-ink-2 hover:text-hero-ink">
                        Open →
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="relative mx-auto w-full max-w-md rounded-2xl bg-ui-surface p-10 text-ui-ink shadow-modal">
            <IconButton
              label="Close"
              icon={<IconClose className="h-4 w-4" />}
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4"
            />
            <div className="text-xs font-bold uppercase tracking-wider text-ui-accent">Presenta · New Presentation</div>
            <h1 className="mt-2 font-display text-2xl font-bold">Set up this presentation</h1>
            <p className="mt-2 text-sm text-ui-ink-2">Personalises the deck, then opens straight into the editor.</p>
            <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ui-ink-2">Project name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. Acme Corp — HQ Workplace Design"
                  className="w-full rounded-lg border border-ui-line bg-ui-raised px-3.5 py-2.5 text-sm outline-none focus:border-ui-accent focus:bg-ui-surface"
                />
                {error && <span className="mt-1 block text-xs text-ui-danger">{error}</span>}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ui-ink-2">Presentation date</span>
                <input readOnly value={date} className="w-full rounded-lg border border-ui-line bg-ui-raised px-3.5 py-2.5 text-sm text-ui-ink-2" />
              </label>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ui-ink-2">Whose project is this?</span>
                <div className="flex gap-2">
                  {BRAND_CHOICES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setBrand(c.key)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center transition ${
                        brand === c.key
                          ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent'
                          : 'border-ui-line bg-ui-raised text-ui-ink-2 hover:border-ui-line-strong'
                      }`}
                    >
                      <span className="block text-sm font-bold">{c.label}</span>
                      <span className="block text-[10px] opacity-70">{c.hint}</span>
                    </button>
                  ))}
                </div>
                <span className="mt-1.5 block text-[11px] text-ui-ink-3">Sets the logo and copyright on every slide — editable per slide later.</span>
              </div>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ui-ink-2">Client logo (optional)</span>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleClientLogoPick} className="absolute h-px w-px overflow-hidden opacity-0" />
                <div className="flex items-center gap-3">
                  {clientLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clientLogo} alt="Client logo preview" className="h-9 w-auto max-w-[120px] object-contain" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-lg border border-dashed border-ui-line-strong px-3 py-2 text-xs font-semibold text-ui-ink-2 transition hover:border-ui-accent hover:text-ui-accent"
                  >
                    {clientLogo ? 'Replace' : '+ Upload logo'}
                  </button>
                  {clientLogo && (
                    <button type="button" onClick={() => setClientLogo(undefined)} className="text-xs font-medium text-ui-ink-3 hover:text-ui-danger">
                      Remove
                    </button>
                  )}
                </div>
                <span className="mt-1.5 block text-[11px] text-ui-ink-3">Appears on the title slide and in the footer. You can add or change it later from inside the deck.</span>
              </div>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ui-ink-2">Accent colour</span>
                <AccentPicker logo={clientLogo} value={accentColor} onChange={setAccentColor} />
                <span className="mt-1.5 block text-[11px] text-ui-ink-3">
                  {clientLogo ? 'Pulled from the client logo — pick one, or set your own.' : 'Upload a client logo above to pull colours from it, or set one manually.'}
                </span>
              </div>
              <button type="submit" className="mt-2 w-full rounded-lg bg-ui-accent py-3 text-sm font-bold text-ui-accent-on transition hover:bg-ui-accent-hover">
                + Create New File
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
