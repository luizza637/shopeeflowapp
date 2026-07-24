CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  generation_id uuid REFERENCES public.ai_generations(id) ON DELETE SET NULL,
  title text,
  storage_path text NOT NULL,
  url text NOT NULL,
  thumbnail_url text,
  duration_seconds numeric,
  width integer,
  height integer,
  mime_type text,
  size_bytes bigint,
  narration_path text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY videos_owner_all ON public.videos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER videos_set_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX videos_user_created_idx ON public.videos(user_id, created_at DESC);