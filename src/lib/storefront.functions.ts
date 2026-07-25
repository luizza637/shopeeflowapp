import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const SlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen");

export const getMyStorefront = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, slug, storefront_title, storefront_bio, storefront_published")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, name, image_url, price, original_price, discount_percent, affiliate_url, url, shop_name, rating, is_public, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (pErr) throw pErr;

    return { profile, products: products ?? [] };
  });

export const updateStorefront = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: SlugSchema,
        storefront_title: z.string().trim().max(80).optional().or(z.literal("")),
        storefront_bio: z.string().trim().max(300).optional().or(z.literal("")),
        storefront_published: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        slug: data.slug,
        storefront_title: data.storefront_title || null,
        storefront_bio: data.storefront_bio || null,
        storefront_published: data.storefront_published,
      })
      .eq("id", userId);
    if (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("Esse endereço da vitrine já está em uso. Escolha outro.");
      throw error;
    }
    return { ok: true };
  });

export const setProductPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), value: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("products")
      .update({ is_public: data.value })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const reorderStorefrontProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), sort_order: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("products")
      .update({ sort_order: data.sort_order })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const getPublicStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().trim().max(60) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabasePublic = createClient<Database>(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: profile } = await supabasePublic
      .from("profiles")
      .select("id, display_name, avatar_url, slug, storefront_title, storefront_bio")
      .eq("slug", data.slug)
      .eq("storefront_published", true)
      .maybeSingle();

    if (!profile) return { profile: null, products: [] as PublicProduct[] };

    const { data: products } = await supabasePublic
      .from("products")
      .select("id, name, image_url, price, original_price, discount_percent, affiliate_url, url, shop_name, rating")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    return { profile, products: (products ?? []) as PublicProduct[] };
  });

export type PublicProduct = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  affiliate_url: string | null;
  url: string | null;
  shop_name: string | null;
  rating: number | null;
};
