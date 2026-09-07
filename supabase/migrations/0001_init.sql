-- Presenta — initial schema.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).

create table if not exists projects (
  id text primary key,
  name text not null,
  client text not null default '',
  prepared_by text not null default '',
  date text not null default '',
  slides jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  snapshot jsonb not null,
  label text,
  is_autosave boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists project_versions_project_id_idx on project_versions(project_id);

alter table projects enable row level security;
alter table project_versions enable row level security;

-- TEMPORARY: no team accounts exist yet (see the build proposal, phase 1),
-- so this is a fully open policy — anyone holding the anon key can read/write
-- any project. This is fine for an internal, unlaunched tool; it is NOT
-- fine once this app has real client data or is shared outside the team.
-- Replace both policies with `auth.uid() = owner_id`-scoped versions the
-- moment Supabase Auth is wired in (add an `owner_id uuid references
-- auth.users` column to `projects` first).
create policy "projects_open_access" on projects for all using (true) with check (true);
create policy "project_versions_open_access" on project_versions for all using (true) with check (true);
