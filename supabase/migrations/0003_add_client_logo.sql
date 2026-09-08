-- Presenta — the client's own logo, plus a presentation accent colour.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Paste ONLY this file's contents into a blank query.

-- client_logo holds a downscaled data URL (or any image URL). Data URLs are the
-- interim approach until Supabase Storage is wired in — see the file-storage gap
-- in the tech stack doc. A 400px-wide logo lands around 30-50KB, which Postgres
-- handles fine, and data URLs also sidestep CORS during PDF/PPTX export.
alter table projects add column if not exists client_logo text;

-- accent_color is a hex string ('#0b72c2'), usually pulled out of the client's
-- logo. Null means fall back to the built-in Presenta blue.
alter table projects add column if not exists accent_color text;

NOTIFY pgrst, 'reload schema';
