-- Presenta — deck-wide typography defaults (size, weight, body face, tracking).
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Paste ONLY this file's contents into a blank query.

-- One jsonb column holding all four axes together, e.g.
-- {"scale":"bold","weight":"regular","bodyFont":"plexSans","tracking":"wide"} —
-- each key is independently optional; a project (and, inside the slides
-- column, an individual slide's own typographyOverride) that omits a key
-- falls back to the built-in default for that one axis. See
-- resolveTypography in src/lib/fonts.ts.
alter table projects add column if not exists typography jsonb;

NOTIFY pgrst, 'reload schema';
