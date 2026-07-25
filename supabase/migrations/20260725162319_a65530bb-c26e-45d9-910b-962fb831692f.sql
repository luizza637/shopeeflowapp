CREATE TABLE public.user_ai_keys (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gemini_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_keys TO authenticated;
GRANT ALL ON public.user_ai_keys TO service_role;

ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai keys"
ON public.user_ai_keys FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_ai_keys_set_updated_at
BEFORE UPDATE ON public.user_ai_keys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();