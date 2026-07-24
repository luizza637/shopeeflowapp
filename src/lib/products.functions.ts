import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(300),
  url: z.string().url().optional().or(z.literal("")),
  affiliate_url: z.string().url().optional().or(z.literal("")),
  image_url: z.string().url().optional().or(z.literal("")),
  price: z.number().nonnegative().nullable().optional(),
  original_price: z.number().nonnegative().nullable().optional(),
  discount_percent: z.number().int().min(0).max(100).nullable().optional(),
  commission_percent: z.number().min(0).max(100).nullable().optional(),
  sales_count: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  shop_name: z.string().max(200).optional().or(z.literal("")),
  category: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  is_favorite: z.boolean().optional(),
});

function empty(v: string | undefined | null) {
  return v === undefined || v === null || v === "" ? null : v;
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        favoritesOnly: z.boolean().optional(),
        sort: z.enum(["recent", "commission", "sales", "rating", "discount"]).default("recent"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("products").select("*").eq("user_id", userId);
    if (data.favoritesOnly) q = q.eq("is_favorite", true);
    if (data.search && data.search.trim())
      q = q.ilike("name", `%${data.search.trim()}%`);

    switch (data.sort) {
      case "commission":
        q = q.order("commission_percent", { ascending: false, nullsFirst: false });
        break;
      case "sales":
        q = q.order("sales_count", { ascending: false, nullsFirst: false });
        break;
      case "rating":
        q = q.order("rating", { ascending: false, nullsFirst: false });
        break;
      case "discount":
        q = q.order("discount_percent", { ascending: false, nullsFirst: false });
        break;
      default:
        q = q.order("created_at", { ascending: false });
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProductInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      name: data.name,
      url: empty(data.url),
      affiliate_url: empty(data.affiliate_url),
      image_url: empty(data.image_url),
      price: data.price ?? null,
      original_price: data.original_price ?? null,
      discount_percent: data.discount_percent ?? null,
      commission_percent: data.commission_percent ?? null,
      sales_count: data.sales_count ?? null,
      rating: data.rating ?? null,
      shop_name: empty(data.shop_name),
      category: empty(data.category),
      notes: empty(data.notes),
      is_favorite: data.is_favorite ?? false,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), value: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("products")
      .update({ is_favorite: data.value })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
