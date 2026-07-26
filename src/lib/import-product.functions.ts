import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

const Input = z.object({
  url: z.string().trim().url().max(2000),
});

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parsePrice(html: string): number | null {
  const raw =
    meta(html, "product:price:amount") ??
    /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i.exec(html)?.[1] ??
    null;
  if (!raw) return null;
  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // A Shopee expõe preços em micro-unidades (x100000) em alguns payloads.
  if (n > 100000) n = n / 100000;
  return Number(n.toFixed(2));
}

/** Importa nome, preço e a foto oficial de um link da Shopee (sem IA). */
export const importFromShopeeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const target = new URL(data.url);
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new Error("Link inválido.");
    }

    const page = await fetch(target.toString(), {
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    if (!page.ok) {
      throw new Error(
        `Não consegui abrir o link (${page.status}). Verifique se ele está público.`,
      );
    }
    const html = await page.text();

    const imageUrl = meta(html, "og:image") ?? meta(html, "twitter:image");
    if (!imageUrl) {
      throw new Error(
        "Não encontrei a foto nesse link. Tente o link completo do produto (shopee.com.br/...) ou envie a foto manualmente.",
      );
    }

    const imgRes = await fetch(decode(imageUrl), { headers: { "User-Agent": UA } });
    if (!imgRes.ok) throw new Error("Não consegui baixar a imagem do produto.");
    const contentType = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error("O link não retornou uma imagem.");
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Imagem muito grande.");

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const path = `${userId}/imported/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr) throw signErr;

    const rawTitle = meta(html, "og:title") ?? /<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
    const title = rawTitle
      ? decode(rawTitle)
          .replace(/\s*\|\s*Shopee.*$/i, "")
          .replace(/^Compre\s+/i, "")
          .slice(0, 160)
      : null;

    return {
      imageUrl: signed.signedUrl,
      name: title,
      price: parsePrice(html),
      shopName: meta(html, "og:site_name") ? decode(meta(html, "og:site_name")!) : null,
    };
  });
