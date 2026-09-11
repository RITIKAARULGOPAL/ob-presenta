-- Presenta — a deck-wide headline font choice.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Paste ONLY this file's contents into a blank query.

-- font_family is one of 'default' | 'editorial' | 'structural' | 'classic'
-- (src/lib/fonts.ts). Null means fall back to the built-in Studio pairing
-- (Archivo), matching every deck created before this column existed.
alter table projects add column if not exists font_family text;

NOTIFY pgrst, 'reload schema';
