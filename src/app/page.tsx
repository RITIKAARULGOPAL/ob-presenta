'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject, deleteProject, listProjects } from '@/lib/data';
import { fileToDataUrl } from '@/lib/imageFile';
import { AccentPicker } from '@/components/AccentPicker';
import { IconTrash } from '@/components/icons';
import type { Brand, ProjectSummary } from '@/types/slide';

const BRAND_CHOICES: { key: Brand; label: string; hint: string }[] = [
  { key: 'skv', label: 'SKV', hint: 'Studiokon Ventures' },
  { key: 'ob', label: 'OB', hint: 'Officebanao' },
  { key: 'both', label: 'Both', hint: 'Joint project' },
];

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [preparedBy, setPreparedBy] = useState('Officebanao');
  const [brand, setBrand] = useState<Brand>('ob');
  const [clientLogo, setClientLogo] = useState<string | undefined>();
  const [accentColor, setAccentColor] = useState<string | undefined>();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [date] = useState(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setError('');
    try {
      const project = await createProject({ name: name.trim(), client: client.trim(), preparedBy: preparedBy.trim(), date, brand, clientLogo, accentColor });
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c1420] px-6 py-16 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 700px at 85% 8%, rgba(11,114,194,.16), transparent 60%), radial-gradient(900px 600px at 90% 95%, rgba(255,255,255,.05), transparent 55%)',
        }}
      />
      <div className="relative w-full max-w-3xl">
        {!showForm ? (
          <>
            <div className="mb-2 font-display text-4xl font-light tracking-[0.3em]">
              Presenta<span className="tracking-normal">.</span>
            </div>
            <p className="mb-1 text-lg font-medium text-white/90">An Interactive Presentation Platform</p>
            <p className="mb-14 text-sm text-white/60">Powered by Officebanao</p>

            <button
              onClick={() => setShowForm(true)}
              className="mb-10 flex w-full items-center gap-5 rounded-2xl border border-dashed border-white/25 bg-white/5 p-7 text-left transition hover:bg-white/10"
            >
              <span className="flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 p-3">
                <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-white" fill="none" strokeWidth={2} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span>
                <span className="block font-display text-lg font-bold">New presentation</span>
                <span className="block text-sm text-white/60">Start from a blank project — set the name, client and date</span>
              </span>
            </button>

            <div className="mb-4 text-xs font-bold uppercase tracking-widest text-white/65">Recent</div>
            <div className="flex flex-col gap-3">
              {projects.length === 0 && <div className="text-sm text-white/50">No saved presentations yet — start a new one above.</div>}
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/[0.07] px-6 py-5 transition hover:bg-white/[0.12]"
                >
                  <button onClick={() => router.push(`/p/${p.id}/edit`)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#5fa8e8]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-white">{p.name}</span>
                      <span className="block text-xs text-white/65">
                        {p.client} · {p.date}
                      </span>
                    </span>
                  </button>
                  {confirmDeleteId === p.id ? (
                    <span className="flex flex-shrink-0 items-center gap-3 text-xs font-semibold">
                      <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 text-red-400 hover:text-red-300">
                        <IconTrash className="h-3.5 w-3.5" /> Delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-white/50 hover:text-white/80">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="flex-shrink-0 text-white/40 hover:text-red-400"
                        aria-label={`Delete ${p.name}`}
                        title={`Delete ${p.name}`}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                      <button onClick={() => router.push(`/p/${p.id}/edit`)} className="flex-shrink-0 text-xs font-semibold text-white/60 hover:text-white">
                        Open →
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-10 text-[#141a2b] shadow-2xl">
            <button onClick={() => setShowForm(false)} className="mb-6 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
              ← Back to Presenta
            </button>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0b72c2]">Presenta · New Presentation</div>
            <h1 className="mt-2 font-display text-2xl font-bold">Set up this presentation</h1>
            <p className="mt-2 text-sm text-slate-500">Personalises the deck, then opens straight into the editor.</p>
            <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Project name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. Acme Corp — HQ Workplace Design"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b72c2] focus:bg-white"
                />
                {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
              </label>
              <div className="flex gap-4">
                <label className="block flex-1">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Client</span>
                  <input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Client name"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b72c2] focus:bg-white"
                  />
                </label>
                <label className="block flex-1">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Prepared by</span>
                  <input
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-[#0b72c2] focus:bg-white"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Presentation date</span>
                <input readOnly value={date} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500" />
              </label>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Whose project is this?</span>
                <div className="flex gap-2">
                  {BRAND_CHOICES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setBrand(c.key)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-center transition ${
                        brand === c.key
                          ? 'border-[#0b72c2] bg-[#e8f2fb] text-[#0b72c2]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-bold">{c.label}</span>
                      <span className="block text-[10px] opacity-70">{c.hint}</span>
                    </button>
                  ))}
                </div>
                <span className="mt-1.5 block text-[11px] text-slate-400">Sets the logo and copyright on every slide — editable per slide later.</span>
              </div>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Client logo (optional)</span>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleClientLogoPick} className="hidden" />
                <div className="flex items-center gap-3">
                  {clientLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clientLogo} alt="Client logo preview" className="h-9 w-auto max-w-[120px] object-contain" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0b72c2] hover:text-[#0b72c2]"
                  >
                    {clientLogo ? 'Replace' : '+ Upload logo'}
                  </button>
                  {clientLogo && (
                    <button type="button" onClick={() => setClientLogo(undefined)} className="text-xs font-medium text-slate-400 hover:text-red-500">
                      Remove
                    </button>
                  )}
                </div>
                <span className="mt-1.5 block text-[11px] text-slate-400">Appears on the title slide and in the footer. You can add or change it later from inside the deck.</span>
              </div>
              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Accent colour</span>
                <AccentPicker logo={clientLogo} value={accentColor} onChange={setAccentColor} />
                <span className="mt-1.5 block text-[11px] text-slate-400">
                  {clientLogo ? 'Pulled from the client logo — pick one, or set your own.' : 'Upload a client logo above to pull colours from it, or set one manually.'}
                </span>
              </div>
              <button type="submit" className="mt-2 w-full rounded-lg bg-[#0b72c2] py-3 text-sm font-bold text-white transition hover:bg-[#095f9f]">
                + Create New File
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
