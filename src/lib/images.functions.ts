import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

const SaveInput = z.object({
  productId: z.string().uuid().optional(),
  base64: z.string().min(20),
  attachToProduct: z.boolean().default(false),
});

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const saveGeneratedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bytes = base64ToBytes(data.base64);
    const folder = `${userId}/${data.productId ?? "loose"}`;
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const path = `${folder}/${filename}`;

    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr) throw signErr;

    if (data.attachToProduct && data.productId) {
      const { error: updErr } = await supabase
        .from("products")
        .update({ image_url: signed.signedUrl })
        .eq("id", data.productId)
        .eq("user_id", userId);
      if (updErr) throw updErr;
    }

    return { path, url: signed.signedUrl };
  });

const UploadInput = z.object({
  base64: z.string().min(20),
  contentType: z
    .string()
    .regex(/^image\/(png|jpeg|jpg|webp)$/i)
    .default("image/jpeg"),
});

/** Envia uma foto do dispositivo do usuário (sem IA) e devolve a URL assinada. */
export const uploadProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bytes = base64ToBytes(data.base64);
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8MB).");

    const ct = data.contentType.toLowerCase();
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, bytes, { contentType: ct, upsert: false });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr) throw signErr;

    return { path, url: signed.signedUrl };
  });
