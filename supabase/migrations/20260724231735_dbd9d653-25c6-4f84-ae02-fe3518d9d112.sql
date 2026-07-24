
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  affiliate_url TEXT,
  image_url TEXT,
  price NUMERIC(12,2),
  original_price NUMERIC(12,2),
  discount_percent INTEGER,
  commission_percent NUMERIC(6,2),
  sales_count INTEGER,
  rating NUMERIC(3,2),
  shop_name TEXT,
  category TEXT,
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_owner_all" ON public.products FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX products_user_idx ON public.products(user_id, created_at DESC);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT,
  hook TEXT,
  script TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT,
  description TEXT,
  titles JSONB,
  duration_seconds INTEGER,
  tone TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_generations_owner_all" ON public.ai_generations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_generations_user_idx ON public.ai_generations(user_id, created_at DESC);
CREATE INDEX ai_generations_product_idx ON public.ai_generations(product_id);
CREATE TRIGGER ai_generations_set_updated_at BEFORE UPDATE ON public.ai_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
