import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TTS_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";
const TTS_MODEL = "openai/gpt-4o-mini-tts";

const Input = z.object({
  text: z.string().min(1).max(4000),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .default("nova"),
  speed: z.number().min(0.5).max(1.5).default(1),
  format: z.enum(["mp3", "wav", "opus"]).default("mp3"),
});

export const generateNarration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { getUserGeminiKey, geminiTts } = await import("./user-gemini.server");

    // 1) Chave pessoal do usuário (não consome o saldo de IA do app).
    const userKey = await getUserGeminiKey(context.supabase as any, context.userId);
    if (userKey) {
      const personal = await geminiTts(userKey, data.text, data.voice);
      if (personal) return personal;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: data.text,
        voice: data.voice,
        speed: data.speed,
        response_format: data.format,
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido.");
    if (res.status === 402)
      throw new Error(
        userKey
          ? "Sua chave do Gemini não conseguiu gerar a narração e o saldo de IA do app está esgotado."
          : "Saldo de IA do app esgotado. Cadastre sua chave do Gemini em Configurações.",
      );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Falha na narração (${res.status}): ${t.slice(0, 200)}`);
    }


    const buf = await res.arrayBuffer();
    // base64 encode
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const mime =
      data.format === "mp3"
        ? "audio/mpeg"
        : data.format === "wav"
          ? "audio/wav"
          : "audio/ogg";
    return { base64, mime, size: bytes.length };
  });
