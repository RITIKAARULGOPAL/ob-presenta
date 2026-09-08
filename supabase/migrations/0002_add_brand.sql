-- Presenta — add per-project brand (SKV / OB / both).
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Paste ONLY this file's contents into a blank query — don't append it to 0001.

alter table projects add column if not exists brand text not null default 'ob';

-- Reload PostgREST's schema cache so the new column is visible immediately —
-- see the note from setup: without this, the API can 404 on the new column
-- for a while even though the migration itself succeeded.
NOTIFY pgrst, 'reload schema';
