import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SearchInput = z.object({
  keyword: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).max(50).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  sortType: z.number().int().min(1).max(5).optional(),
});

/** Busca oficial de ofertas na Shopee Affiliate API. */
export const searchShopeeOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { searchOffers } = await import("./shopee.server");
    return searchOffers({
      keyword: data.keyword || undefined,
      page: data.page,
      limit: data.limit,
      sortType: data.sortType,
    });
  });

/** Gera um link curto de afiliada para qualquer URL da Shopee. */
export const createShopeeAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().trim().url().max(2000),
        subId: z.string().trim().max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { shortLink } = await import("./shopee.server");
    const link = await shortLink(data.url, data.subId ? [data.subId] : []);
    return { link };
  });

const ImportInput = z.object({
  itemId: z.string().max(64),
  name: z.string().trim().min(1).max(300),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  price: z.number().nullable().optional(),
  originalPrice: z.number().nullable().optional(),
  discountPercent: z.number().nullable().optional(),
  commissionPercent: z.number().nullable().optional(),
  salesCount: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  shopName: z.string().max(200).nullable().optional(),
  productLink: z.string().url().max(2000).nullable().optional(),
  offerLink: z.string().url().max(2000).nullable().optional(),
});

/** Salva uma oferta da Shopee como produto, já com o link de afiliada. */
export const importShopeeOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let affiliateUrl = data.offerLink ?? null;
    if (!affiliateUrl && data.productLink) {
      try {
        const { shortLink } = await import("./shopee.server");
        affiliateUrl = await shortLink(data.productLink, []);
      } catch {
        affiliateUrl = null;
      }
    }

    const round = (v: number | null | undefined) =>
      v === null || v === undefined ? null : Number(v.toFixed(2));

    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        user_id: userId,
        name: data.name.slice(0, 300),
        url: data.productLink ?? null,
        affiliate_url: affiliateUrl,
        image_url: data.imageUrl ?? null,
        price: round(data.price),
        original_price: round(data.originalPrice),
        discount_percent:
          data.discountPercent === null || data.discountPercent === undefined
            ? null
            : Math.round(data.discountPercent),
        commission_percent: round(data.commissionPercent),
        sales_count:
          data.salesCount === null || data.salesCount === undefined
            ? null
            : Math.round(data.salesCount),
        rating: round(data.rating),
        shop_name: data.shopName ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });
