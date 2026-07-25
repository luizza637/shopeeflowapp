
CREATE TABLE public.scheduled_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('tiktok','instagram','shopee')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed','cancelled','manual')),
  caption text,
  hashtags text,
  external_url text,
  external_id text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scheduled_posts_user_time_idx ON public.scheduled_posts(user_id, scheduled_at);
CREATE INDEX scheduled_posts_due_idx ON public.scheduled_posts(status, scheduled_at) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_posts_owner_all ON public.scheduled_posts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_daily_post_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  day_count integer;
BEGIN
  IF NEW.status IN ('cancelled','failed') THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO day_count
  FROM public.scheduled_posts
  WHERE user_id = NEW.user_id
    AND status IN ('pending','publishing','published','manual')
    AND scheduled_at::date = NEW.scheduled_at::date
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF day_count >= 5 THEN
    RAISE EXCEPTION 'Limite diário de 5 publicações atingido para %', NEW.scheduled_at::date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER scheduled_posts_daily_limit
  BEFORE INSERT OR UPDATE OF scheduled_at, status ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_post_limit();
