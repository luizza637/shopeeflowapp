ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS storefront_title text,
  ADD COLUMN IF NOT EXISTS storefront_bio text,
  ADD COLUMN IF NOT EXISTS storefront_published boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.products TO anon;

DROP POLICY IF EXISTS "Public storefront profiles are viewable" ON public.profiles;
CREATE POLICY "Public storefront profiles are viewable"
ON public.profiles FOR SELECT TO anon
USING (storefront_published = true AND slug IS NOT NULL);

DROP POLICY IF EXISTS "Public storefront products are viewable" ON public.products;
CREATE POLICY "Public storefront products are viewable"
ON public.products FOR SELECT TO anon
USING (
  is_public = true
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = products.user_id AND p.storefront_published = true AND p.slug IS NOT NULL
  )
);