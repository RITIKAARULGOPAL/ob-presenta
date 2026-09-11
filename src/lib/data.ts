import { makeId } from './id';
import { createSlide } from './slideDefaults';
import { supabase } from './supabaseClient';
import type { Brand, FontPairing, Project, ProjectSummary } from '@/types/slide';

// ---------------------------------------------------------------------------
// Data layer — backed by Supabase Postgres. This is the only file that talks
// to storage; every caller (the editor store, pages) goes through these five
// functions, so the earlier localStorage version could be swapped out for
// this one without touching anything else in the app.
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  prepared_by: string;
  date: string;
  brand: Brand;
  client_logo: string | null;
  accent_color: string | null;
  font_family: FontPairing | null;
  slides: Project['slides'];
  created_at: number;
  updated_at: number;
}

function fromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    preparedBy: row.prepared_by,
    date: row.date,
    brand: row.brand ?? 'ob',
    clientLogo: row.client_logo ?? undefined,
    accentColor: row.accent_color ?? undefined,
    fontFamily: row.font_family ?? undefined,
    slides: row.slides,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, client, date, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('listProjects failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    client: r.client,
    date: r.date,
    updatedAt: r.updated_at,
  }));
}

/** Columns added by migrations 0003 and 0004. When a migration hasn't been
 * applied to the target database, Postgres rejects the entire write with
 * 42703 rather than ignoring the unknown columns — which silently broke every
 * create and every save. We retry once without them, so the deck still works
 * and only the newer fields (logo, accent colour, font) fail to stick. */
const OPTIONAL_COLUMNS = ['client_logo', 'accent_color', 'font_family'] as const;

/** An unknown column surfaces under two different codes depending on who
 * catches it: PostgREST rejects writes against its own schema cache before
 * Postgres ever sees them (PGRST204), while reads reach Postgres and come back
 * as 42703. Matching only one of the two silently misses the write path. */
const UNKNOWN_COLUMN_CODES = new Set(['PGRST204', '42703']);

function isUnknownColumn(error: { code?: string } | null): boolean {
  return !!error?.code && UNKNOWN_COLUMN_CODES.has(error.code);
}

let missingOptionalColumns = false;

/** True once a write has proven migration 0003 is absent, so the UI can explain
 * why a logo or accent colour didn't stick instead of just losing it. */
export function optionalColumnsMissing(): boolean {
  return missingOptionalColumns;
}

function warnOnce() {
  if (missingOptionalColumns) return;
  missingOptionalColumns = true;
  console.warn(
    'Presenta: migration 0003_add_client_logo.sql and/or 0004_add_font_family.sql ' +
      'have not been applied, so the client logo, accent colour and/or font choice ' +
      'cannot be saved. Everything else works.',
  );
}

function withoutOptionalColumns<T extends Record<string, unknown>>(row: T): Partial<T> {
  const copy: Record<string, unknown> = { ...row };
  for (const column of OPTIONAL_COLUMNS) delete copy[column];
  return copy as Partial<T>;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('getProject failed:', error.message);
    return null;
  }
  if (!data) return null;
  // select('*') returns only the columns that exist, so a row missing any of
  // these keys tells us a migration is absent without spending another
  // request — and lets the editor warn on load rather than after the first
  // failed save. Checking all of them (not just the first) matters once
  // migrations can land independently: 0003 applied without 0004 would
  // otherwise read as "nothing missing" and hide the font column gap.
  const row = data as Record<string, unknown>;
  if (OPTIONAL_COLUMNS.some((c) => !(c in row))) warnOnce();
  return fromRow(data as ProjectRow);
}

export async function createProject(input: {
  name: string;
  client: string;
  preparedBy: string;
  date: string;
  brand: Brand;
  clientLogo?: string;
  accentColor?: string;
  fontFamily?: FontPairing;
}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: makeId('proj'),
    name: input.name,
    client: input.client,
    preparedBy: input.preparedBy,
    date: input.date,
    brand: input.brand,
    clientLogo: input.clientLogo,
    accentColor: input.accentColor,
    fontFamily: input.fontFamily,
    slides: [createSlide('title-slide')],
    createdAt: now,
    updatedAt: now,
  };
  const row = {
    id: project.id,
    name: project.name,
    client: project.client,
    prepared_by: project.preparedBy,
    date: project.date,
    brand: project.brand,
    client_logo: project.clientLogo ?? null,
    accent_color: project.accentColor ?? null,
    font_family: project.fontFamily ?? null,
    slides: project.slides,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };

  let { error } = await supabase.from('projects').insert(row);
  if (isUnknownColumn(error)) {
    warnOnce();
    ({ error } = await supabase.from('projects').insert(withoutOptionalColumns(row)));
  }
  // Returning the project regardless used to send the editor to a row that was
  // never written, which surfaced as "Couldn't find that project."
  if (error) throw new Error(error.message);
  return project;
}

export async function saveProject(project: Project): Promise<void> {
  const updatedAt = Date.now();
  const row = {
    name: project.name,
    client: project.client,
    prepared_by: project.preparedBy,
    date: project.date,
    brand: project.brand,
    client_logo: project.clientLogo ?? null,
    accent_color: project.accentColor ?? null,
    font_family: project.fontFamily ?? null,
    slides: project.slides,
    updated_at: updatedAt,
  };

  let { error } = await supabase.from('projects').update(row).eq('id', project.id);
  if (isUnknownColumn(error)) {
    warnOnce();
    ({ error } = await supabase.from('projects').update(withoutOptionalColumns(row)).eq('id', project.id));
  }
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('deleteProject failed:', error.message);
}
