import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UrlInput = z.object({ url: z.string().trim().url().max(2000) });

/** Lê um link da Shopee e devolve foto, nome, preço, comissão e link de afiliada. */
export const lookupShopeeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data }) => {
    const { lookupShopeeLink } = await import("./shopee-import.server");
    return lookupShopeeLink(data.url);
  });

/** Lê um único link comum da Shopee, cria o link de afiliado e salva o produto. */
export const saveShopeeProductFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().trim().url().max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { lookupShopeeLink } = await import("./shopee-import.server");
    const product = await lookupShopeeLink(data.url);
    if (!product.name.trim()) {
      throw new Error(
        "Não consegui identificar esse produto. Copie o link comum na página do produto da Shopee e tente novamente.",
      );
    }

    const round = (value: number | null | undefined) =>
      value === null || value === undefined ? null : Number(value.toFixed(2));
    const productUrl = product.productLink || data.url;

    const { data: existing } = await context.supabase
      .from("products")
      .select("id, name")
      .eq("user_id", context.userId)
      .or(`url.eq.${productUrl},affiliate_url.eq.${product.affiliateUrl ?? ""}`)
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    const { data: saved, error } = await context.supabase
      .from("products")
      .insert({
        user_id: context.userId,
        name: product.name.slice(0, 300),
        url: productUrl,
        affiliate_url: product.affiliateUrl,
        image_url: product.imageUrl,
        price: round(product.price),
        original_price: round(product.originalPrice),
        discount_percent:
          product.discountPercent === null ? null : Math.round(product.discountPercent),
        commission_percent: round(product.commissionPercent),
        sales_count: product.salesCount === null ? null : Math.round(product.salesCount),
        rating: round(product.rating),
        shop_name: product.shopName,
      })
      .select("id, name")
      .single();
    if (error) throw error;
    return saved;
  });

/** Importa todos os produtos de um link de coleção/vitrine da Shopee. */
export const importShopeeCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UrlInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { lookupShopeeCollection } = await import("./shopee-import.server");

    const items = await lookupShopeeCollection(data.url);
    if (!items.length) {
      throw new Error(
        "Não encontrei produtos nesse link. Abra a coleção no navegador, copie o link completo e tente de novo.",
      );
    }

    const { data: existing } = await supabase
      .from("products")
      .select("url, affiliate_url")
      .eq("user_id", userId);
    const seen = new Set(
      (existing ?? []).flatMap((p) => [p.url, p.affiliate_url].filter(Boolean) as string[]),
    );

    const round = (v: number | null | undefined) =>
      v === null || v === undefined ? null : Number(v.toFixed(2));

    const rows = items
      .filter((i) => !(i.productLink && seen.has(i.productLink)))
      .map((i) => ({
        user_id: userId,
        name: i.name.slice(0, 300),
        url: i.productLink ?? null,
        affiliate_url: i.affiliateUrl ?? null,
        image_url: i.imageUrl ?? null,
        price: round(i.price),
        original_price: round(i.originalPrice),
        discount_percent:
          i.discountPercent === null || i.discountPercent === undefined
            ? null
            : Math.round(i.discountPercent),
        commission_percent: round(i.commissionPercent),
        sales_count:
          i.salesCount === null || i.salesCount === undefined ? null : Math.round(i.salesCount),
        rating: round(i.rating),
        shop_name: i.shopName ?? null,
      }));

    if (!rows.length) return { imported: 0, skipped: items.length };

    const { error } = await supabase.from("products").insert(rows);
    if (error) throw error;
    return { imported: rows.length, skipped: items.length - rows.length };
  });
