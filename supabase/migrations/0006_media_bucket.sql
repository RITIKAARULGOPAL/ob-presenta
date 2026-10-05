-- Presenta — storage bucket for uploaded videos (hero and walkthrough).
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Paste ONLY this file's contents into a blank query. Safe to re-run.

-- Videos are too big for the project row (images go there as base64), so they
-- live here and a slide keeps the public URL. 50 MB per file, the free tier's cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- TEMPORARY open access, same stance as 0001_init.sql: no accounts exist yet.
-- No delete policy on purpose: removing a video from a slide leaves the file,
-- because Undo and duplicated slides can still point at it.
drop policy if exists "media_open_read" on storage.objects;
drop policy if exists "media_open_insert" on storage.objects;
create policy "media_open_read" on storage.objects for select using (bucket_id = 'media');
create policy "media_open_insert" on storage.objects for insert with check (bucket_id = 'media');
