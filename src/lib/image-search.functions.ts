import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export type WebImage = {
  url: string;
  thumb: string;
  title: string;
  source: string;
};

const SearchInput = z.object({
  query: z.string().trim().min(2).max(120),
});

async function searchDuckDuckGo(query: string): Promise<WebImage[]> {
  const tokenRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } },
  );
  const html = await tokenRes.text();
  const vqd =
    html.match(/vqd=["']?([\d-]+)["']?/)?.[1] ?? html.match(/vqd=([\d-]+)&/)?.[1];
  if (!vqd) return [];

  const res = await fetch(
    `https://duckduckgo.com/i.js?l=pt-br&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript; q=0.01",
        Referer: "https://duckduckgo.com/",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    results?: Array<{ image?: string; thumbnail?: string; title?: string; url?: string }>;
  };
  return (json.results ?? [])
    .filter((r) => r.image)
    .map((r) => ({
      url: r.image!,
      thumb: r.thumbnail || r.image!,
      title: r.title ?? "",
      source: r.url ?? "",
    }));
}

async function searchBing(query: string): Promise<WebImage[]> {
  const res = await fetch(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`,
    { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } },
  );
  if (!res.ok) return [];
  const html = await res.text();
  const out: WebImage[] = [];
  const seen = new Set<string>();
  const re = /"murl":"(.*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1].replace(/\\u002f/g, "/").replace(/\\\//g, "/");
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, thumb: url, title: "", source: "" });
    if (out.length >= 40) break;
  }
  return out;
}

/** Busca imagens abertas na web (DuckDuckGo, com Bing como reserva). */
export const searchWebImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    let results: WebImage[] = [];
    try {
      results = await searchDuckDuckGo(data.query);
    } catch {
      results = [];
    }
    if (results.length === 0) {
      try {
        results = await searchBing(data.query);
      } catch {
        results = [];
      }
    }
    return { results: results.slice(0, 30) };
  });

const SaveInput = z.object({
  url: z.string().url(),
});

/** Baixa uma imagem encontrada na web e guarda no storage do usuário. */
export const saveImageFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await fetch(data.url, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*" },
    });
    if (!res.ok) throw new Error("Não consegui baixar essa imagem, tente outra.");

    const ct = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].toLowerCase();
    if (!ct.startsWith("image/")) throw new Error("Esse link não é uma imagem.");

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) throw new Error("Imagem vazia, tente outra.");
    if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 10MB).");

    const ext = ct.includes("png")
      ? "png"
      : ct.includes("webp")
        ? "webp"
        : ct.includes("gif")
          ? "gif"
          : "jpg";
    const path = `${userId}/web/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, buf, { contentType: ct, upsert: false });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr) throw signErr;

    return { path, url: signed.signedUrl };
  });
