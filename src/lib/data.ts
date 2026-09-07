import { makeId } from './id';
import { createSlide } from './slideDefaults';
import type { Project, ProjectSummary } from '@/types/slide';

// ---------------------------------------------------------------------------
// Data layer. Backed by localStorage today; this is the ONLY file that should
// need to change when it's swapped for real Supabase calls (see the build
// proposal: projects/slides live in Postgres as jsonb, same shape as below).
// Every function here is async on purpose, even though localStorage is sync
// — callers already treat this as I/O, so the Supabase swap is a body-only
// change, not a call-site change.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'presenta_projects_v1';

function readAll(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function writeAll(projects: Project[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return readAll()
    .map(({ id, name, client, date, updatedAt }) => ({ id, name, client, date, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  return readAll().find((p) => p.id === id) ?? null;
}

export async function createProject(input: {
  name: string;
  client: string;
  preparedBy: string;
  date: string;
}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: makeId('proj'),
    name: input.name,
    client: input.client,
    preparedBy: input.preparedBy,
    date: input.date,
    slides: [createSlide('title-slide')],
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.unshift(project);
  writeAll(all);
  return project;
}

export async function saveProject(project: Project): Promise<void> {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAt: Date.now() };
  if (idx === -1) all.unshift(updated);
  else all[idx] = updated;
  writeAll(all);
}

export async function deleteProject(id: string): Promise<void> {
  writeAll(readAll().filter((p) => p.id !== id));
}
