// Client-side vertical video composer.
// Renders a 1080x1920 canvas with a Ken Burns zoom on the product image,
// overlays synced captions, mixes narration + optional music, and records
// the result as WebM via MediaRecorder. WebM re-encode strips original
// metadata; the file is streamed to Supabase Storage.

export type ComposeOptions = {
  imageUrl: string | null;
  /** Cenas extras (ex.: apresentador IA). Cada uma vira um corte no vídeo. */
  sceneImageUrls?: string[];
  captionsText: string; // narration/script text used to derive captions
  narrationUrl?: string | null; // blob or data URL
  musicUrl?: string | null; // blob or data URL, optional
  durationSeconds: number; // 15 | 30 | 60
  title?: string;
  cta?: string;
  brand?: string;
  onProgress?: (t: number, total: number) => void;
  onFrame?: (previewDataUrl: string) => void;
};


export type ComposeResult = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  width: number;
  height: number;
  thumbnailBase64: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c))
      return c;
  }
  return "video/webm";
}

async function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function splitCaptions(text: string, duration: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  // split into short phrases by punctuation, keep ~4-6 words each
  const parts = clean
    .split(/(?<=[\.\!\?\,\;\:])\s+/g)
    .flatMap((p) => {
      const words = p.split(" ");
      if (words.length <= 6) return [p];
      const out: string[] = [];
      for (let i = 0; i < words.length; i += 5) {
        out.push(words.slice(i, i + 5).join(" "));
      }
      return out;
    })
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [] as { start: number; end: number; text: string }[];
  // Distribui o tempo proporcionalmente ao tamanho de cada trecho (fala real),
  // em vez de dividir igualmente — isso mantém a legenda sincronizada com a voz.
  const weights = parts.map((p) => Math.max(1, p.replace(/\s+/g, "").length));
  const totalW = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return parts.map((t, i) => {
    const start = (acc / totalW) * duration;
    acc += weights[i];
    const end = (acc / totalW) * duration;
    return { start, end, text: t };
  });
}


function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function composeVideo(
  opts: ComposeOptions,
): Promise<ComposeResult> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  // Cenas: apresentador IA (quando houver) + foto do produto.
  const sceneUrls = [
    ...(opts.sceneImageUrls ?? []),
    ...(opts.imageUrl ? [opts.imageUrl] : []),
  ];
  const loaded = (await Promise.all(sceneUrls.map((u) => loadImage(u)))).filter(
    (i): i is HTMLImageElement => !!i,
  );
  const scenes = loaded.length ? loaded : [];
  
  const captions = splitCaptions(opts.captionsText, opts.durationSeconds);


  // Audio graph
  const AudioCtx =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx: AudioContext = new AudioCtx({ sampleRate: 48000 });
  const dest = audioCtx.createMediaStreamDestination();

  const loadAudioBuffer = async (url: string) => {
    const r = await fetch(url);
    const ab = await r.arrayBuffer();
    return await audioCtx.decodeAudioData(ab);
  };

  let narrationBuf: AudioBuffer | null = null;
  let musicBuf: AudioBuffer | null = null;
  try {
    if (opts.narrationUrl) narrationBuf = await loadAudioBuffer(opts.narrationUrl);
  } catch {}
  try {
    if (opts.musicUrl) musicBuf = await loadAudioBuffer(opts.musicUrl);
  } catch {}

  const stream = canvas.captureStream(FPS);
  if (dest.stream.getAudioTracks()[0])
    stream.addTrack(dest.stream.getAudioTracks()[0]);

  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (recorder.onstop = () => res()));

  // Desenha uma imagem cobrindo o quadro com zoom/pan (Ken Burns)
  const drawCover = (
    image: HTMLImageElement,
    scale: number,
    panX: number,
    panY: number,
    alpha = 1,
  ) => {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const baseScale = Math.max(WIDTH / iw, HEIGHT / ih) * scale;
    const dw = iw * baseScale;
    const dh = ih * baseScale;
    const dx = (WIDTH - dw) / 2 + panX;
    const dy = (HEIGHT - dh) / 2 + panY;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.globalAlpha = prev;
  };

  const FADE = 0.5; // segundos de crossfade entre cenas
  const sceneLen = scenes.length ? opts.durationSeconds / scenes.length : 0;

  const drawScene = (index: number, t: number, alpha: number) => {
    const image = scenes[index];
    if (!image) return;
    const local = Math.min(1, Math.max(0, (t - index * sceneLen) / sceneLen));
    // direção do movimento alterna por cena para dar ritmo
    const dir = index % 2 === 0 ? 1 : -1;
    const scale = 1.06 + 0.16 * easeInOut(local);
    const panX = dir * (Math.sin(local * Math.PI) * 46);
    const panY = dir * (-28 + local * 56);
    drawCover(image, scale, panX, panY, alpha);
  };

  const drawFrame = (t: number) => {
    // background gradient
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, "#1a0f0a");
    g.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (scenes.length) {
      const idx = Math.min(scenes.length - 1, Math.floor(t / sceneLen));
      drawScene(idx, t, 1);
      // crossfade com a cena seguinte
      const next = idx + 1;
      const timeIntoNext = t - next * sceneLen;
      if (next < scenes.length && timeIntoNext > -FADE) {
        const a = Math.min(1, Math.max(0, (timeIntoNext + FADE) / FADE));
        drawScene(next, Math.max(t, next * sceneLen), a);
      }
    }


    // vignette
    const rg = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.35,
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.7,
    );
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // top brand pill
    if (opts.brand) {
      ctx.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
      const label = opts.brand;
      const pad = 28;
      const w = ctx.measureText(label).width + pad * 2;
      const x = (WIDTH - w) / 2;
      const y = 90;
      ctx.fillStyle = "rgba(255, 106, 0, 0.95)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, 62, 31);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(label, WIDTH / 2, y + 32);
    }

    // title (top)
    if (opts.title && t < opts.durationSeconds * 0.35) {
      const alpha = Math.min(1, t * 2);
      ctx.globalAlpha = alpha;
      ctx.font = "800 78px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const maxW = WIDTH - 160;
      const lines = wrapText(ctx, opts.title, maxW).slice(0, 3);
      let y = 200;
      for (const l of lines) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(l, WIDTH / 2 + 4, y + 4);
        ctx.fillStyle = "#fff";
        ctx.fillText(l, WIDTH / 2, y);
        y += 92;
      }
      ctx.globalAlpha = 1;
    }

    // caption (bottom band)
    const cap = captions.find((c) => t >= c.start && t < c.end);
    if (cap) {
      ctx.font = "700 64px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const maxW = WIDTH - 140;
      const lines = wrapText(ctx, cap.text, maxW).slice(0, 3);
      const lineH = 82;
      const total = lines.length * lineH;
      const bandY = HEIGHT - 420;
      // band
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(70, bandY, WIDTH - 140, total + 80, 32);
      ctx.fill();
      let y = bandY + 40 + lineH / 2;
      for (const l of lines) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillText(l, WIDTH / 2 + 3, y + 3);
        ctx.fillStyle = "#fff";
        ctx.fillText(l, WIDTH / 2, y);
        y += lineH;
      }
    }

    // CTA pill (last third)
    if (opts.cta && t > opts.durationSeconds * 0.7) {
      const alpha = Math.min(1, (t - opts.durationSeconds * 0.7) * 3);
      ctx.globalAlpha = alpha;
      ctx.font = "800 56px system-ui, -apple-system, Segoe UI, sans-serif";
      const label = opts.cta.slice(0, 40);
      const pad = 44;
      const w = ctx.measureText(label).width + pad * 2;
      const x = (WIDTH - w) / 2;
      const y = HEIGHT - 220;
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, "#ff6a00");
      grad.addColorStop(1, "#ff2e63");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 96, 48);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, WIDTH / 2, y + 48);
      ctx.globalAlpha = 1;
    }
  };

  // Kick off audio playback synchronized with recording start
  const startAudio = () => {
    const now = audioCtx.currentTime + 0.05;
    if (narrationBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = narrationBuf;
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      src.connect(gain).connect(dest);
      src.start(now);
    }
    if (musicBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = musicBuf;
      src.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = narrationBuf ? 0.15 : 0.5;
      src.connect(gain).connect(dest);
      src.start(now);
    }
  };

  await audioCtx.resume();

  recorder.start(100);
  startAudio();
  const t0 = performance.now();

  await new Promise<void>((resolve) => {
    let raf = 0;
    const step = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const t = Math.min(elapsed, opts.durationSeconds);
      drawFrame(t);
      opts.onProgress?.(t, opts.durationSeconds);
      if (opts.onFrame && Math.floor(elapsed * 4) !== Math.floor((elapsed - 1 / FPS) * 4)) {
        try {
          opts.onFrame(canvas.toDataURL("image/jpeg", 0.6));
        } catch {}
      }
      if (elapsed >= opts.durationSeconds) {
        cancelAnimationFrame(raf);
        resolve();
      } else {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
  });

  recorder.stop();
  await stopped;
  await audioCtx.close();

  const blob = new Blob(chunks, { type: mimeType });

  // Thumbnail from last-frame canvas (currently the last rendered CTA frame — grab a mid frame instead)
  drawFrame(opts.durationSeconds * 0.35);
  const thumbDataUrl = canvas.toDataURL("image/jpeg", 0.75);
  const thumbnailBase64 = thumbDataUrl.split(",")[1] ?? "";

  return {
    blob,
    mimeType,
    durationSeconds: opts.durationSeconds,
    width: WIDTH,
    height: HEIGHT,
    thumbnailBase64,
  };
}
