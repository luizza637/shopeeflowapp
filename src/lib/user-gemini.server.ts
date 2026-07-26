/**
 * Helpers para usar a chave pessoal do Gemini do usuário (Google AI Studio)
 * antes de cair no saldo de IA compartilhado do app.
 */

type SupabaseLike = {
  from: (table: string) => any;
};

export async function getUserGeminiKey(
  supabase: SupabaseLike,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("user_ai_keys")
      .select("gemini_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.gemini_api_key as string | undefined)?.trim() || null;
  } catch {
    return null;
  }
}

const TEXT_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];

/** Gera JSON estruturado com a chave do usuário. Retorna null quando não deu. */
export async function geminiJson(
  apiKey: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  for (const model of TEXT_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: sanitizeSchema(schema),
            },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn(`[gemini-text] ${model} falhou (${res.status}): ${t.slice(0, 200)}`);
        continue;
      }
      const payload = (await res.json()) as any;
      const text = payload?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("");
      if (!text) continue;
      return JSON.parse(text) as Record<string, unknown>;
    } catch (e) {
      console.warn(`[gemini-text] ${model} erro`, e);
    }
  }
  return null;
}

const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];

/** Mapeia as vozes do app para vozes prontas do Gemini. */
const VOICE_MAP: Record<string, string> = {
  nova: "Aoede",
  shimmer: "Kore",
  alloy: "Leda",
  fable: "Autonoe",
  echo: "Charon",
  onyx: "Puck",
};

function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  const dataSize = pcm.length;
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  const out = new Uint8Array(44 + dataSize);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Narração com a chave pessoal. Retorna WAV base64 ou null. */
export async function geminiTts(
  apiKey: string,
  text: string,
  voice: string,
): Promise<{ base64: string; mime: string; size: number } | null> {
  const voiceName = VOICE_MAP[voice] ?? "Aoede";
  for (const model of TTS_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName } },
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn(`[gemini-tts] ${model} falhou (${res.status}): ${t.slice(0, 200)}`);
        continue;
      }
      const payload = (await res.json()) as any;
      const b64 = payload?.candidates?.[0]?.content?.parts?.find(
        (p: any) => p?.inlineData?.data,
      )?.inlineData?.data as string | undefined;
      if (!b64) continue;
      const bin = atob(b64);
      const pcm = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
      const wav = pcmToWav(pcm);
      return { base64: bytesToBase64(wav), mime: "audio/wav", size: wav.length };
    } catch (e) {
      console.warn(`[gemini-tts] ${model} erro`, e);
    }
  }
  return null;
}
