import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";


type ImageEventPayload =
  | {
      type: "image_generation.partial_image";
      b64_json: string;
      partial_image_index: number;
      created_at: number;
    }
  | {
      type: "image_generation.completed";
      b64_json: string;
      created_at: number;
    }
  | {
      type: "error";
      error: { message: string; type?: string; code?: string };
    };

export async function streamImage(
  endpoint: string,
  input: { prompt: string; imageUrl?: string | null; imageUrls?: string[] },
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image generation failed: ${res.status} ${text.slice(0, 200)}`);
  }

  let sawCompleted = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        // Ignore keepalives / [DONE]
      }
      if (event.event === "error" || payload?.type === "error") {
        streamError =
          (payload as { error?: { message?: string } })?.error?.message ??
          "Falha na geração da imagem";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      if (!payload || !("b64_json" in payload) || !payload.b64_json) return;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => {
        onFrame(`data:image/png;base64,${payload!.b64_json as string}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Fluxo de imagem terminou sem imagem final");
}
