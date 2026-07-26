import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const GenerateInput = z.object({
  productId: z.string().uuid(),
  tone: z.enum(["divertido", "urgente", "informativo", "emocional", "profissional"]).default("divertido"),
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
  language: z.string().default("pt-BR"),
  extraNotes: z.string().max(500).optional(),
});

const ContentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Título curto e chamativo do vídeo" },
    titles: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
      description: "Variações de títulos chamativos",
    },
    hook: { type: "string", description: "Gancho impactante para os 3 primeiros segundos" },
    script: {
      type: "string",
      description: "Roteiro em texto corrido, pronto para ser lido por uma narradora. NÃO inclua rótulos como 'Cena 1:', 'Narração:', 'Gancho:', 'CTA:' nem indicações entre parênteses/colchetes. Apenas as frases faladas, separadas por ponto final.",
    },
    cta: { type: "string", description: "Call-to-action final claro e persuasivo" },
    caption: { type: "string", description: "Legenda pronta para Instagram/TikTok, com emojis" },
    hashtags: {
      type: "string",
      description: "10 a 15 hashtags separadas por espaço, começando com #",
    },
    description: { type: "string", description: "Descrição comercial curta do produto" },
  },
  required: ["title", "titles", "hook", "script", "cta", "caption", "hashtags", "description"],
} as const;

export const generateProductContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const { supabase, userId } = context;
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!product) throw new Error("Produto não encontrado");

    const targetWords = Math.floor(data.durationSeconds * 2.5);
    const system = `Você é um roteirista de vídeos curtos verticais (TikTok/Reels/Shopee Video) para afiliados da Shopee no Brasil. Escreva em ${data.language}. Tom envolvente, direto, persuasivo. Nunca use markdown, asteriscos ou aspas decorativas.

REGRA CRÍTICA sobre o campo "script":
- Deve conter APENAS as falas que a narradora vai ler em voz alta, em primeira pessoa, falando diretamente com o espectador.
- PROIBIDO incluir instruções de cena, ação, câmera, edição ou tela. Nada de: "mostre X na tela", "coloque o produto na caixinha", "aparece o preço", "corte para", "zoom em", "insira legenda", "faça uma pausa", "Cena 1", "Narração:", "Gancho:", "CTA:", nem parênteses/colchetes com direções.
- Se for descrever algo visual, transforme em fala natural. Ex: em vez de "mostre o preço baixinho", escreva "e olha esse precinho, sai por menos de trinta reais".
- Frases curtas separadas por ponto final. Sem títulos internos, sem numeração.
- Alvo: aproximadamente ${targetWords} palavras no total (para caber em ${data.durationSeconds}s de narração).`;

    const user = [
      `Produto: ${product.name}`,
      product.shop_name ? `Loja: ${product.shop_name}` : null,
      product.category ? `Categoria: ${product.category}` : null,
      product.price != null ? `Preço: R$ ${product.price}` : null,
      product.original_price != null ? `Preço original: R$ ${product.original_price}` : null,
      product.discount_percent != null ? `Desconto: ${product.discount_percent}%` : null,
      product.commission_percent != null ? `Comissão de afiliado: ${product.commission_percent}%` : null,
      product.sales_count != null ? `Vendas: ${product.sales_count}` : null,
      product.rating != null ? `Avaliação: ${product.rating}/5` : null,
      product.notes ? `Notas: ${product.notes}` : null,
      data.extraNotes ? `Contexto extra: ${data.extraNotes}` : null,
      "",
      `Tom desejado: ${data.tone}. Duração alvo do vídeo: ${data.durationSeconds} segundos.`,
      `Gere um pacote completo de conteúdo para o vídeo. Responda APENAS o JSON solicitado.`,
    ]
      .filter(Boolean)
      .join("\n");

    const { getUserGeminiKey, geminiJson } = await import("./user-gemini.server");
    let parsed: Record<string, unknown> | null = null;

    // 1) Chave pessoal do usuário (não consome o saldo de IA do app).
    const userKey = await getUserGeminiKey(supabase as any, userId);
    if (userKey) {
      parsed = await geminiJson(userKey, system, user, ContentSchema as any);
    }

    if (!parsed) {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_content",
                description: "Emitir o pacote de conteúdo para o vídeo",
                parameters: ContentSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "emit_content" } },
        }),
      });

      if (response.status === 429) {
        throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      }
      if (response.status === 402) {
        throw new Error(
          userKey
            ? "Sua chave do Gemini não conseguiu gerar o roteiro e o saldo de IA do app está esgotado. Confira a chave em Configurações."
            : "Saldo de IA do app esgotado. Cadastre sua chave do Gemini em Configurações para continuar.",
        );
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Falha na IA (${response.status}): ${text.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{ function?: { arguments?: string } }>;
            content?: string;
          };
        }>;
      };

      const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        const fallback = payload.choices?.[0]?.message?.content ?? "";
        throw new Error(`IA não retornou conteúdo estruturado. ${fallback.slice(0, 120)}`);
      }
      try {
        parsed = JSON.parse(args);
      } catch {
        throw new Error("Resposta da IA inválida (JSON malformado).");
      }
    }

    if (!parsed) throw new Error("A IA não retornou conteúdo. Tente novamente.");




    const record = {
      user_id: userId,
      product_id: product.id,
      title: String(parsed.title ?? ""),
      hook: String(parsed.hook ?? ""),
      script: String(parsed.script ?? ""),
      cta: String(parsed.cta ?? ""),
      caption: String(parsed.caption ?? ""),
      hashtags: String(parsed.hashtags ?? ""),
      description: String(parsed.description ?? ""),
      titles: Array.isArray(parsed.titles) ? parsed.titles : [],
      duration_seconds: data.durationSeconds,
      tone: data.tone,
      model: MODEL,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("ai_generations")
      .insert(record)
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted;
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("ai_generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data.productId) q = q.eq("product_id", data.productId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
