import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint disparado pelo pg_cron (a cada 5 min) para processar
// publicações agendadas cujo horário já passou. É "public" (bypass da auth
// do site), então protege com apikey do Supabase antes de qualquer coisa.

const TIKTOK_GATEWAY = "https://connector-gateway.lovable.dev/tiktok";
const SIGNED_TTL = 60 * 60 * 6;

type ScheduledRow = {
  id: string;
  user_id: string;
  video_id: string;
  platform: "tiktok" | "instagram" | "shopee";
  caption: string | null;
  hashtags: string | null;
  attempt_count: number;
  videos: { storage_path: string; title: string | null; url: string } | null;
  products: { name: string | null; affiliate_url: string | null } | null;
};

async function publishToTikTok(
  signedUrl: string,
): Promise<{ external_id?: string; external_url?: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TIKTOK_API_KEY = process.env.TIKTOK_API_KEY;
  if (!LOVABLE_API_KEY || !TIKTOK_API_KEY) {
    throw new Error(
      "TikTok não configurado. Conecte o conector TikTok em Configurações → Integrações.",
    );
  }
  const res = await fetch(`${TIKTOK_GATEWAY}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TIKTOK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_info: {
        source: "PULL_FROM_URL",
        video_url: signedUrl,
      },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`TikTok (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = JSON.parse(body) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };
  if (json.error?.code && json.error.code !== "ok") {
    throw new Error(`TikTok: ${json.error.message ?? json.error.code}`);
  }
  return {
    external_id: json.data?.publish_id,
    external_url: "https://www.tiktok.com/",
  };
}

export const Route = createFileRoute("/api/public/hooks/process-scheduled-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("scheduled_posts")
          .select(
            "id, user_id, video_id, platform, caption, hashtags, attempt_count, videos(storage_path, title, url), products(name, affiliate_url)",
          )
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(20);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = (due ?? []) as unknown as ScheduledRow[];
        const results: Array<{ id: string; status: string; message?: string }> = [];

        for (const row of rows) {
          await supabaseAdmin
            .from("scheduled_posts")
            .update({
              status: "publishing",
              attempt_count: row.attempt_count + 1,
            })
            .eq("id", row.id);

          try {
            if (!row.videos?.storage_path) {
              throw new Error("Vídeo indisponível");
            }

            if (row.platform === "tiktok") {
              const { data: signed, error: sErr } = await supabaseAdmin.storage
                .from("product-videos")
                .createSignedUrl(row.videos.storage_path, SIGNED_TTL);
              if (sErr || !signed?.signedUrl) {
                throw new Error("Não foi possível gerar link do vídeo");
              }
              const r = await publishToTikTok(signed.signedUrl);
              await supabaseAdmin
                .from("scheduled_posts")
                .update({
                  status: "published",
                  published_at: new Date().toISOString(),
                  external_id: r.external_id ?? null,
                  external_url: r.external_url ?? null,
                  error_message: null,
                })
                .eq("id", row.id);
              results.push({ id: row.id, status: "published" });
              continue;
            }

            // Instagram e Shopee ainda não têm publicação automática.
            // Marca como "manual" para o usuário publicar via link.
            await supabaseAdmin
              .from("scheduled_posts")
              .update({
                status: "manual",
                error_message:
                  row.platform === "instagram"
                    ? "Instagram Reels ainda exige publicação manual. Baixe o vídeo e publique."
                    : "Shopee Video ainda exige publicação manual pelo app.",
              })
              .eq("id", row.id);
            results.push({ id: row.id, status: "manual" });
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("scheduled_posts")
              .update({
                status: "failed",
                error_message: message.slice(0, 500),
              })
              .eq("id", row.id);
            results.push({ id: row.id, status: "failed", message });
          }
        }

        return Response.json({ processed: rows.length, results });
      },
    },
  },
});
