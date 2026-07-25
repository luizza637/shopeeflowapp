import { createFileRoute } from "@tanstack/react-router";

const MODEL = "google/gemini-3.1-flash-image";
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/images/generations";

// Modelo usado quando o usuário traz a própria chave do Google AI Studio.
const GOOGLE_MODEL = "gemini-2.5-flash-image";

type InlinePart = { inline_data: { mime_type: string; data: string } };

async function toInlinePart(url: string): Promise<InlinePart | null> {
  try {
    if (url.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (!match) return null;
      return { inline_data: { mime_type: match[1], data: match[2] } };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { inline_data: { mime_type: mime, data: btoa(binary) } };
  } catch {
    return null;
  }
}

/** Busca a chave pessoal do Gemini do usuário autenticado (RLS garante o isolamento). */
async function getUserGeminiKey(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/rest/v1/user_ai_keys?select=gemini_api_key&limit=1`, {
      headers: { apikey: anon, Authorization: auth },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ gemini_api_key?: string | null }>;
    return rows?.[0]?.gemini_api_key?.trim() || null;
  } catch {
    return null;
  }
}

function sseResponse(events: string) {
  return new Response(events, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

function sseError(message: string) {
  return sseResponse(
    `event: error\ndata: ${JSON.stringify({ type: "error", error: { message } })}\n\n`,
  );
}

/**
 * Gera com a chave pessoal do usuário.
 * Retorna `null` quando a cota da chave estourou (429) — nesse caso o chamador
 * cai automaticamente no saldo de IA do app para não travar o usuário.
 */
async function generateWithUserKey(
  apiKey: string,
  prompt: string,
  refs: string[],
): Promise<Response | null> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const ref of refs) {
    const part = await toInlinePart(ref);
    if (part) parts.push(part);
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) {
      console.warn("[generate-image] cota da chave pessoal do Gemini esgotada:", text.slice(0, 400));
      return null; // fallback para o saldo do app
    }
    if (res.status === 400 || res.status === 403) {
      return sseError("Chave do Gemini inválida ou sem acesso ao modelo de imagens.");
    }
    return sseError(`Falha no Gemini (${res.status}): ${text.slice(0, 160)}`);
  }


  const payload = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> };
    }>;
  };
  const b64 = payload.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data || p.inline_data?.data,
  );
  const data = b64?.inlineData?.data ?? b64?.inline_data?.data;
  if (!data) return sseError("O Gemini não retornou nenhuma imagem.");

  return sseResponse(
    `event: image_generation.completed\ndata: ${JSON.stringify({
      type: "image_generation.completed",
      b64_json: data,
      created_at: Date.now(),
    })}\n\n`,
  );
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { prompt?: string; imageUrl?: string | null; imageUrls?: string[] } = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const prompt = (body.prompt ?? "").toString().trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        const refs = [
          ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
          ...(body.imageUrl ? [body.imageUrl] : []),
        ].filter((u): u is string => typeof u === "string" && u.length > 0);

        // 1) Chave pessoal do usuário (não consome o saldo de IA do workspace).
        const userKey = await getUserGeminiKey(request);
        if (userKey) {
          return generateWithUserKey(userKey, prompt, refs);
        }

        // 2) Fallback: gateway de IA da Lovable.
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
        for (const url of refs) {
          content.push({ type: "image_url", image_url: { url } });
        }

        const upstream = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
