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
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) {
    console.warn("[generate-image] variáveis do Supabase ausentes no servidor");
    return null;
  }
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
 * Retorna `{ response }` em caso de sucesso/erro definitivo, ou `{ reason }`
 * quando não deu para usar a chave (cota/modelo indisponível) e vale tentar
 * o saldo de IA do app.
 */
async function generateWithUserKey(
  apiKey: string,
  prompt: string,
  refs: string[],
): Promise<{ response?: Response; reason?: string }> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const ref of refs) {
    const part = await toInlinePart(ref);
    if (part) parts.push(part);
  }

  const candidates = [
    GOOGLE_MODEL,
    "gemini-2.5-flash-image-preview",
    "gemini-2.0-flash-preview-image-generation",
  ];
  let res: Response | null = null;
  let lastText = "";
  let lastStatus = 0;
  for (const model of candidates) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );
    if (res.ok) break;
    lastStatus = res.status;
    lastText = await res.text().catch(() => "");
    console.warn(
      `[generate-image] modelo ${model} falhou (${res.status}): ${lastText.slice(0, 300)}`,
    );
    // 404 = modelo inexistente para a chave; 429 = sem cota nesse modelo.
    if (res.status !== 404 && res.status !== 429) break;
    res = null;
  }

  if (!res || !res.ok) {
    if (lastStatus === 429) {
      return {
        reason:
          "Sua chave do Gemini não tem cota para gerar imagens (o modelo de imagens do Google exige faturamento ativo na conta do Google AI Studio).",
      };
    }
    if (lastStatus === 400 || lastStatus === 403) {
      return {
        response: sseError(
          "Sua chave do Gemini é inválida ou não tem acesso ao modelo de imagens. Confira a chave em Configurações.",
        ),
      };
    }
    return { reason: `Sua chave do Gemini falhou (${lastStatus}).` };
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
  if (!data) return { response: sseError("O Gemini não retornou nenhuma imagem.") };

  return {
    response: sseResponse(
      `event: image_generation.completed\ndata: ${JSON.stringify({
        type: "image_generation.completed",
        b64_json: data,
        created_at: Date.now(),
      })}\n\n`,
    ),
  };
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
        let personalReason: string | null = null;
        if (userKey) {
          const personal = await generateWithUserKey(userKey, prompt, refs);
          if (personal.response) return personal.response;
          personalReason = personal.reason ?? null;
          // não deu para usar a chave pessoal → tenta o saldo do app
        } else {
          console.warn("[generate-image] nenhuma chave pessoal do Gemini encontrada para o usuário");
        }


        // 2) Fallback: gateway de IA da Lovable.
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return sseError("Serviço de imagens indisponível (chave do app ausente).");

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
          console.error(`[generate-image] gateway falhou (${upstream.status}): ${text.slice(0, 300)}`);
          if (upstream.status === 402) {
            return sseError(
              personalReason
                ? `${personalReason} O saldo de imagens do app também acabou este mês — isso não tem relação com a sua conta, é o saldo compartilhado do aplicativo.`
                : userKey
                  ? "Não consegui usar sua chave do Gemini e o saldo de imagens do app (compartilhado) acabou este mês. Confira a chave em Configurações."
                  : "O saldo de imagens do app (compartilhado, não é da sua conta) acabou este mês. Cadastre sua chave do Gemini em Configurações para continuar gerando imagens.",
            );
          }
          if (upstream.status === 429) {
            return sseError("Muitas requisições agora. Aguarde alguns instantes e tente de novo.");
          }
          return sseError(`Falha na geração da imagem (${upstream.status}).`);
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
