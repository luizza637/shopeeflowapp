import { drawOverlays, type Overlay } from "./video-overlays";

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
const FPS = 24;
const MAX_CANVAS_PIXELS = 1080 * 1920;

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
  outW: number,
  outH: number,
) {
  const WIDTH = outW;
  const HEIGHT = outH;
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

function getScaledOutputSize(width: number, height: number) {
  const safeWidth = width || WIDTH;
  const safeHeight = height || HEIGHT;
  const pixels = safeWidth * safeHeight;
  if (pixels <= MAX_CANVAS_PIXELS) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = Math.sqrt(MAX_CANVAS_PIXELS / pixels);
  return {
    width: Math.max(2, Math.round((safeWidth * scale) / 2) * 2),
    height: Math.max(2, Math.round((safeHeight * scale) / 2) * 2),
  };
}

function waitForEvent(
  target: HTMLMediaElement,
  eventName: keyof HTMLMediaElementEventMap,
  timeoutMs: number,
) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      target.removeEventListener(eventName, finish);
      if (timeout) clearTimeout(timeout);
      resolve();
    };
    target.addEventListener(eventName, finish, { once: true });
    timeout = setTimeout(finish, timeoutMs);
  });
}

async function waitForDrawableFrame(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  await waitForEvent(video, "loadeddata", 2500);
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
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return "";
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
    overlays?: Overlay[];
    onProgress?: (ratio: number) => void;
  } = {},
): Promise<SanitizeResult> {
  const mode = opts.mode ?? "keep";
  const srcUrl = URL.createObjectURL(file);
  let attachedVideo: HTMLVideoElement | null = null;
  let raf = 0;
  let renderTimer: ReturnType<typeof setInterval> | undefined;
  let elementStream: MediaStream | null = null;
  let canvasStream: MediaStream | null = null;

  try {
    const video = await loadVideo(srcUrl);
    attachedVideo = video;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error("Vídeo sem duração válida.");

    const overlays = (opts.overlays ?? []).filter((o) => o.text.trim());

    if (mode === "keep" && overlays.length === 0) {
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

    // ---- render no canvas (9:16 forçado ou tamanho original com balões) ----
    const originalSize = getScaledOutputSize(video.videoWidth, video.videoHeight);
    const OUT_W = mode === "reencode" ? WIDTH : originalSize.width;
    const OUT_H = mode === "reencode" ? HEIGHT : originalSize.height;

    if (typeof MediaRecorder === "undefined") {
      throw new Error(
        "Este navegador não consegue salvar vídeo com balões. Tente pelo Chrome atualizado.",
      );
    }

    // O elemento precisa estar no documento e "renderizável", senão alguns
    // navegadores não decodificam os frames e o resultado sai todo preto.
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "0";
    video.style.width = "8px";
    video.style.height = "8px";
    video.style.opacity = "0.01";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);

    // Mantemos o vídeo mudo no alto-falante (autoplay não é bloqueado assim),
    // mas o áudio continua disponível via captureStream do próprio elemento.
    video.muted = true;
    (video as any).defaultMuted = true;
    video.volume = 0;

    await new Promise<void>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", finish);
        if (timeout) clearTimeout(timeout);
        resolve();
      };
      video.addEventListener("seeked", finish, { once: true });
      try {
        video.currentTime = 0;
      } catch {
        finish();
      }
      timeout = setTimeout(finish, 2000);
    });
    await waitForDrawableFrame(video);

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Não consegui preparar o editor de balões.");

    const captureCanvas =
      canvas.captureStream?.bind(canvas) ??
      (canvas as unknown as { mozCaptureStream?: (fps?: number) => MediaStream })
        .mozCaptureStream?.bind(canvas);
    if (!captureCanvas) {
      throw new Error(
        "Este navegador não consegue gravar balões no vídeo. Tente pelo Chrome atualizado.",
      );
    }
    canvasStream = captureCanvas(FPS);
    // Áudio: pegamos direto do elemento (não usa AudioContext, não trava)
    try {
      const capture =
        (video as any).captureStream?.bind(video) ??
        (video as any).mozCaptureStream?.bind(video);
      if (capture) {
        elementStream = capture() as MediaStream;
        elementStream.getAudioTracks().forEach((t) => canvasStream?.addTrack(t));
      }
    } catch {
      elementStream = null;
    }

    const mimeType = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_500_000,
      });
    } catch {
      recorder = new MediaRecorder(canvasStream);
    }
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const outType = recorder.mimeType || mimeType;
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: outType }));
      recorder.onerror = () => reject(new Error("A gravação do vídeo falhou."));
    });

    let thumbnailBase64 = "";
    const paint = () => {
      drawCover(ctx, video, opts.fit ?? "cover", OUT_W, OUT_H);
      if (overlays.length)
        drawOverlays(ctx, OUT_W, OUT_H, overlays, video.currentTime);
    };
    const tick = () => {
      paint();
      if (!thumbnailBase64 && video.currentTime > 0.2) {
        thumbnailBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
      }
      opts.onProgress?.(Math.min(1, video.currentTime / duration));
      if (typeof requestAnimationFrame === "function") {
        raf = requestAnimationFrame(tick);
      }
    };

    // primeiro frame já desenhado antes de começar a gravar
    paint();
    recorder.start(500);
    try {
      await video.play();
    } catch {
      if (recorder.state !== "inactive") recorder.stop();
      throw new Error(
        "O navegador bloqueou a reprodução do vídeo. Toque na tela e tente de novo.",
      );
    }
    if (typeof requestAnimationFrame === "function") {
      tick();
    } else {
      renderTimer = setInterval(() => {
        paint();
        opts.onProgress?.(Math.min(1, video.currentTime / duration));
      }, 1000 / FPS);
    }

    // Espera o fim do vídeo, com rede de segurança caso 'ended' não dispare
    await new Promise<void>((resolve) => {
      let settled = false;
      let watch: ReturnType<typeof setInterval> | undefined;
      let hardStop: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("ended", finish);
        if (watch) clearInterval(watch);
        if (hardStop) clearTimeout(hardStop);
        resolve();
      };
      video.addEventListener("ended", finish, { once: true });
      watch = setInterval(() => {
        if (video.ended || (duration && video.currentTime >= duration - 0.15))
          finish();
      }, 250);
      // limite: duração + 20s
      hardStop = setTimeout(finish, (duration + 20) * 1000);
    });

    if (raf) cancelAnimationFrame(raf);
    if (renderTimer) clearInterval(renderTimer);
    // pequeno respiro pro último frame entrar no arquivo
    await new Promise((r) => setTimeout(r, 300));
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await done;

    if (!thumbnailBase64) {
      thumbnailBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
    }

    if (!blob.size) {
      throw new Error(
        "A gravação saiu vazia. Tente novamente com o vídeo um pouco menor.",
      );
    }

    return {
      blob,
      mimeType: outType,

      durationSeconds: Math.round(duration),
      width: OUT_W,
      height: OUT_H,
      thumbnailBase64,
    };
  } finally {
    if (raf) cancelAnimationFrame(raf);
    if (renderTimer) clearInterval(renderTimer);
    try {
      elementStream?.getTracks().forEach((t) => t.stop());
      canvasStream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    attachedVideo?.remove();
    URL.revokeObjectURL(srcUrl);
  }
}
