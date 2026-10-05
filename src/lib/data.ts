import { makeId } from './id';
import { createSlide } from './slideDefaults';
import { supabase } from './supabaseClient';
import type { Brand, FontPairing, Project, ProjectSummary, TypographySettings } from '@/types/slide';

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
  typography: TypographySettings | null;
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
    typography: row.typography ?? undefined,
    slides: row.slides,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Typed `string`, not inferred as a literal: supabase-js's `.select()` tries
// to statically parse a literal select-string argument at the type level, and
// its grammar doesn't recognise the `->` JSON-path syntax below (even though
// PostgREST itself accepts it fine at runtime — verified live). Widening to
// `string` here makes the template literal built from these plain `string`
// too, which sidesteps that parser instead of fighting it.
const LIST_BASE_COLUMNS: string = 'id, name, client, date, updated_at, brand, created_at';
// slides->0 returns the whole first-slide JSON object (not the rest of the
// array) — Home's card thumbnails screenshot it via captureThumbnail.ts.
const LIST_FIRST_SLIDE_COLUMN: string = 'first_slide:slides->0';

function fromListRow(r: Record<string, unknown>): ProjectSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    client: r.client as string,
    date: r.date as string,
    updatedAt: r.updated_at as number,
    brand: r.brand as Brand,
    createdAt: r.created_at as number,
    accentColor: (r.accent_color as string | null) ?? undefined,
    fontFamily: (r.font_family as FontPairing | null) ?? undefined,
    typography: (r.typography as TypographySettings | null) ?? undefined,
    clientLogo: (r.client_logo as string | null) ?? undefined,
    firstSlide: (r.first_slide as ProjectSummary['firstSlide']) ?? null,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  // Both built as explicitly `string`-typed locals, not passed as inline
  // template literals: TS infers an inline template literal built from
  // `string`-typed parts as a `${string}, ${string}...` template literal
  // TYPE (not the general `string` type), which supabase-js's `.select()`
  // then tries to statically parse the same way it would a literal — and
  // fails on the `->` JSON-path syntax. An explicit `: string` annotation on
  // the variable itself forces real widening to `string`.
  const fullSelect: string = `${LIST_BASE_COLUMNS}, ${OPTIONAL_COLUMNS.join(', ')}, ${LIST_FIRST_SLIDE_COLUMN}`;
  const fallbackSelect: string = `${LIST_BASE_COLUMNS}, ${LIST_FIRST_SLIDE_COLUMN}`;
  let { data, error } = await supabase.from('projects').select(fullSelect).order('updated_at', { ascending: false });
  if (isUnknownColumn(error)) {
    warnOnce();
    ({ data, error } = await supabase.from('projects').select(fallbackSelect).order('updated_at', { ascending: false }));
  }
  if (error) {
    console.error('listProjects failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => fromListRow(r as unknown as Record<string, unknown>));
}

/** Columns added by migrations 0003 through 0005. When a migration hasn't
 * been applied to the target database, Postgres rejects the entire write
 * with 42703 rather than ignoring the unknown columns — which silently broke
 * every create and every save. We retry once without them, so the deck still
 * works and only the newer fields (logo, accent colour, font, typography)
 * fail to stick. */
const OPTIONAL_COLUMNS = ['client_logo', 'accent_color', 'font_family', 'typography'] as const;

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
    'Presenta: migration 0003_add_client_logo.sql, 0004_add_font_family.sql and/or ' +
      '0005_add_typography.sql have not been applied, so the client logo, accent colour, ' +
      'font choice and/or typography settings cannot be saved. Everything else works.',
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
  typography?: TypographySettings;
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
    typography: input.typography,
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
    typography: project.typography ?? null,
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
    typography: project.typography ?? null,
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
