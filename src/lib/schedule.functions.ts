import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Platform = z.enum(["tiktok", "instagram", "shopee"]);

export const listScheduledPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select(
        "*, videos(title, thumbnail_url, url, storage_path, duration_seconds), products(name, image_url, affiliate_url)",
      )
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const CreateInput = z.object({
  videoId: z.string().uuid(),
  platform: Platform,
  scheduledAt: z.string().datetime(),
  caption: z.string().max(2200).optional(),
  hashtags: z.string().max(600).optional(),
});

export const createScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: video, error: vErr } = await supabase
      .from("videos")
      .select("id, product_id, title")
      .eq("id", data.videoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!video) throw new Error("Vídeo não encontrado");

    // Evita agendar o mesmo vídeo duas vezes na mesma plataforma como pendente
    const { data: dup } = await supabase
      .from("scheduled_posts")
      .select("id")
      .eq("user_id", userId)
      .eq("video_id", data.videoId)
      .eq("platform", data.platform)
      .in("status", ["pending", "publishing", "manual"])
      .maybeSingle();
    if (dup) throw new Error("Esse vídeo já está agendado nessa plataforma");

    const scheduled = new Date(data.scheduledAt);
    if (scheduled.getTime() < Date.now() - 60_000) {
      throw new Error("O horário precisa estar no futuro");
    }

    const { data: row, error } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: userId,
        video_id: data.videoId,
        product_id: video.product_id,
        platform: data.platform,
        scheduled_at: scheduled.toISOString(),
        caption: data.caption ?? null,
        hashtags: data.hashtags ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      if (/Limite diário/.test(error.message)) {
        throw new Error(
          "Limite de 5 publicações por dia atingido. Escolha outra data.",
        );
      }
      throw error;
    }
    return row;
  });

const IdInput = z.object({ id: z.string().uuid() });

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

const RescheduleInput = z.object({
  id: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

export const rescheduleScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RescheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: data.scheduledAt, status: "pending", error_message: null })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) {
      if (/Limite diário/.test(error.message)) {
        throw new Error("Limite de 5 publicações por dia atingido nessa data.");
      }
      throw error;
    }
    return { ok: true };
  });
