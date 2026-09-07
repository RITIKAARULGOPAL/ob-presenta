import { makeId } from './id';
import { createSlide } from './slideDefaults';
import { supabase } from './supabaseClient';
import type { Project, ProjectSummary } from '@/types/slide';

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

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('getProject failed:', error.message);
    return null;
  }
  return data ? fromRow(data as ProjectRow) : null;
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
  const { error } = await supabase.from('projects').insert({
    id: project.id,
    name: project.name,
    client: project.client,
    prepared_by: project.preparedBy,
    date: project.date,
    slides: project.slides,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });
  if (error) console.error('createProject failed:', error.message);
  return project;
}

export async function saveProject(project: Project): Promise<void> {
  const updatedAt = Date.now();
  const { error } = await supabase
    .from('projects')
    .update({
      name: project.name,
      client: project.client,
      prepared_by: project.preparedBy,
      date: project.date,
      slides: project.slides,
      updated_at: updatedAt,
    })
    .eq('id', project.id);
  if (error) console.error('saveProject failed:', error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('deleteProject failed:', error.message);
}
