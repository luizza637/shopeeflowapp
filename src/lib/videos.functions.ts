import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_TTL = 60 * 60 * 24 * 365;

export const listVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("videos")
      .select("*, products(name, image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const SaveInput = z.object({
  productId: z.string().uuid().optional(),
  generationId: z.string().uuid().optional(),
  title: z.string().optional(),
  storagePath: z.string().min(1),
  durationSeconds: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  thumbnailBase64: z.string().optional(),
});

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const saveVideoRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: signed, error: signErr } = await supabase.storage
      .from("product-videos")
      .createSignedUrl(data.storagePath, SIGNED_TTL);
    if (signErr) throw signErr;

    let thumbUrl: string | null = null;
    if (data.thumbnailBase64) {
      const bytes = base64ToBytes(data.thumbnailBase64);
      const thumbPath = `${data.storagePath}.thumb.jpg`;
      const { error: upErr } = await supabase.storage
        .from("product-videos")
        .upload(thumbPath, bytes, { contentType: "image/jpeg", upsert: true });
      if (!upErr) {
        const { data: s } = await supabase.storage
          .from("product-videos")
          .createSignedUrl(thumbPath, SIGNED_TTL);
        thumbUrl = s?.signedUrl ?? null;
      }
    }

    const { data: row, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        product_id: data.productId ?? null,
        generation_id: data.generationId ?? null,
        title: data.title ?? null,
        storage_path: data.storagePath,
        url: signed.signedUrl,
        thumbnail_url: thumbUrl,
        duration_seconds: data.durationSeconds ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        mime_type: data.mimeType ?? null,
        size_bytes: data.sizeBytes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: findErr } = await supabase
      .from("videos")
      .select("storage_path, thumbnail_url")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (row) {
      const paths = [row.storage_path, `${row.storage_path}.thumb.jpg`];
      await supabase.storage.from("product-videos").remove(paths);
    }
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
