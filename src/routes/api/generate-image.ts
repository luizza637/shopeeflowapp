import { createFileRoute } from "@tanstack/react-router";

const MODEL = "google/gemini-3.1-flash-image";
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/images/generations";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: { prompt?: string; imageUrl?: string | null; imageUrls?: string[] } = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const prompt = (body.prompt ?? "").toString().trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        const refs = [
          ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
          ...(body.imageUrl ? [body.imageUrl] : []),
        ].filter((u): u is string => typeof u === "string" && u.length > 0);

        const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
        for (const url of refs) {
          content.push({ type: "image_url", image_url: { url } });
        }

        const upstream = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
