ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS hashtags text;