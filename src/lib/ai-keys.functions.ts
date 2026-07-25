import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function maskKey(key: string) {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export const getGeminiKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_ai_keys")
      .select("gemini_api_key, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const key = data?.gemini_api_key ?? null;
    return {
      configured: Boolean(key),
      masked: key ? maskKey(key) : null,
      updatedAt: data?.updated_at ?? null,
    };
  });

export const saveGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Valida a chave contra a API do Google antes de salvar.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(data.apiKey)}`,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 || res.status === 403) {
        throw new Error("Chave do Gemini inválida ou sem permissão.");
      }
      throw new Error(`Não foi possível validar a chave (${res.status}). ${text.slice(0, 120)}`);
    }

    const { error } = await supabase
      .from("user_ai_keys")
      .upsert({ user_id: userId, gemini_api_key: data.apiKey }, { onConflict: "user_id" });
    if (error) throw error;
    return { configured: true, masked: maskKey(data.apiKey) };
  });

export const deleteGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_ai_keys").delete().eq("user_id", userId);
    if (error) throw error;
    return { configured: false };
  });
