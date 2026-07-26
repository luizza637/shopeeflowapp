// Importação de vídeo no navegador.
//
// Modo "keep" (padrão): NÃO reencoda nada. O vídeo é enviado byte a byte,
// mantendo duração, resolução e qualidade originais. O arquivo é reembalado
// como um Blob novo e salvo com nome aleatório, então nome do arquivo, data de
// modificação e origem não vão junto.
//
// Modo "reencode": reprocessa via canvas + MediaRecorder para forçar 9:16
// (1080x1920) e apagar qualquer metadado gravado dentro do container.

export type SanitizeResult = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  width: number;
  height: number;
  thumbnailBase64: string;
};

export type SanitizeMode = "keep" | "reencode";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

function pickMime(): string {
  const candidates = [
    'video/mp4;codecs="avc1.4d0028,mp4a.40.2"',
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4",
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mode: "cover" | "contain",
) {
  const vw = video.videoWidth || WIDTH;
  const vh = video.videoHeight || HEIGHT;
  const scale =
    mode === "cover"
      ? Math.max(WIDTH / vw, HEIGHT / vh)
      : Math.min(WIDTH / vw, HEIGHT / vh);
  const w = vw * scale;
  const h = vh * scale;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2;

  if (mode === "contain") {
    ctx.save();
    ctx.filter = "blur(40px) brightness(0.6)";
    const bg = Math.max(WIDTH / vw, HEIGHT / vh) * 1.15;
    ctx.drawImage(
      video,
      (WIDTH - vw * bg) / 2,
      (HEIGHT - vh * bg) / 2,
      vw * bg,
      vh * bg,
    );
    ctx.restore();
  }
  ctx.drawImage(video, x, y, w, h);
}

async function loadVideo(url: string) {
  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Não consegui ler esse vídeo."));
  });
  return video;
}

async function grabThumbnail(video: HTMLVideoElement): Promise<string> {
  const w = video.videoWidth || WIDTH;
  const h = video.videoHeight || HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const target = Math.min(1, (video.duration || 1) / 2);
  await new Promise<void>((resolve) => {
    const onSeeked = () => resolve();
    video.onseeked = onSeeked;
    try {
      video.currentTime = target;
    } catch {
      resolve();
    }
    setTimeout(resolve, 3000);
  });
  try {
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
  } catch {
    return "";
  }
}

export async function sanitizeVideo(
  file: File,
  opts: {
    mode?: SanitizeMode;
    fit?: "cover" | "contain";
    onProgress?: (ratio: number) => void;
  } = {},
): Promise<SanitizeResult> {
  const mode = opts.mode ?? "keep";
  const srcUrl = URL.createObjectURL(file);

  try {
    const video = await loadVideo(srcUrl);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error("Vídeo sem duração válida.");

    if (mode === "keep") {
      opts.onProgress?.(0.3);
      const thumbnailBase64 = await grabThumbnail(video);
      opts.onProgress?.(0.8);
      // Blob novo, sem nome de arquivo nem data de modificação do original.
      const bytes = await file.arrayBuffer();
      const mimeType = file.type || "video/mp4";
      const blob = new Blob([bytes], { type: mimeType });
      opts.onProgress?.(1);
      return {
        blob,
        mimeType,
        durationSeconds: Math.round(duration),
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        thumbnailBase64,
      };
    }

    // ---- modo reencode (9:16 forçado) ----
    video.currentTime = 0;
    video.muted = false;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const stream = canvas.captureStream(FPS);

    let audioCtx: AudioContext | null = null;
    try {
      const AC: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AC();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      audioCtx = null;
    }

    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    let thumbnailBase64 = "";
    let raf = 0;
    const tick = () => {
      drawCover(ctx, video, opts.fit ?? "cover");
      if (!thumbnailBase64 && video.currentTime > 0.2) {
        thumbnailBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
      }
      opts.onProgress?.(Math.min(1, video.currentTime / duration));
      raf = requestAnimationFrame(tick);
    };

    recorder.start(1000);
    await video.play();
    tick();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    cancelAnimationFrame(raf);
    recorder.stop();
    const blob = await done;
    try {
      await audioCtx?.close();
    } catch {
      /* ignore */
    }

    if (!thumbnailBase64) {
      thumbnailBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
    }

    return {
      blob,
      mimeType,
      durationSeconds: Math.round(duration),
      width: WIDTH,
      height: HEIGHT,
      thumbnailBase64,
    };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}
