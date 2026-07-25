DROP POLICY IF EXISTS "Anyone can record a storefront view" ON public.storefront_views;

REVOKE INSERT, UPDATE, DELETE ON public.storefront_views FROM anon;
REVOKE INSERT, UPDATE ON public.storefront_views FROM authenticated;
REVOKE SELECT ON public.storefront_views FROM anon;

GRANT SELECT, DELETE ON public.storefront_views TO authenticated;
GRANT ALL ON public.storefront_views TO service_role;

CREATE POLICY "Owners can delete their storefront views"
ON public.storefront_views
FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);