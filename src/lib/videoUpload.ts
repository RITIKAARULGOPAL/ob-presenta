import { supabase } from './supabaseClient';
import { makeId } from './id';

const BUCKET = 'media';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export class VideoUploadError extends Error {}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

/** Uploads to the `media` bucket (migration 0006) and returns its public URL. */
export async function uploadVideo(file: File): Promise<string> {
  if (!isVideoFile(file)) throw new VideoUploadError('That file is not a video.');
  if (file.size > MAX_VIDEO_BYTES) {
    throw new VideoUploadError(`That video is ${(file.size / 1024 / 1024).toFixed(0)} MB; the limit is 50 MB.`);
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-60);
  const path = `videos/${makeId('vid')}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'video/mp4',
    upsert: false,
  });
  if (error) {
    console.error('Video upload failed:', error);
    if (/bucket not found/i.test(error.message)) {
      throw new VideoUploadError("Video storage isn't set up yet — run migration 0006 in Supabase.");
    }
    throw new VideoUploadError('Could not upload that video.');
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function videoUploadMessage(err: unknown): string {
  return err instanceof VideoUploadError ? err.message : 'Could not upload that video.';
}
