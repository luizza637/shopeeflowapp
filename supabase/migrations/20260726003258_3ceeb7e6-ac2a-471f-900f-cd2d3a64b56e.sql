CREATE TABLE public.product_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  slug text,
  visitor_hash text,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_clicks_profile_day_idx ON public.product_clicks (profile_id, day);
CREATE INDEX product_clicks_product_idx ON public.product_clicks (product_id);

GRANT SELECT ON public.product_clicks TO authenticated;
GRANT ALL ON public.product_clicks TO service_role;

ALTER TABLE public.product_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their product clicks"
ON public.product_clicks FOR SELECT TO authenticated
USING (auth.uid() = profile_id);