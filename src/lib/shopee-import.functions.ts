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
