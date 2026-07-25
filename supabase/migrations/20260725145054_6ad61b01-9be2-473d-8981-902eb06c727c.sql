CREATE TABLE IF NOT EXISTS public.storefront_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  slug text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  visitor_hash text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_views_profile_day_idx
  ON public.storefront_views (profile_id, day);

GRANT SELECT ON public.storefront_views TO authenticated;
GRANT INSERT ON public.storefront_views TO anon, authenticated;
GRANT ALL ON public.storefront_views TO service_role;

ALTER TABLE public.storefront_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a storefront view"
ON public.storefront_views FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = storefront_views.profile_id
      AND p.storefront_published = true
      AND p.slug = storefront_views.slug
  )
);

CREATE POLICY "Owners can read their storefront views"
ON public.storefront_views FOR SELECT TO authenticated
USING (auth.uid() = profile_id);