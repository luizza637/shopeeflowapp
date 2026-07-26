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
    overlays?: Overlay[];
    onProgress?: (ratio: number) => void;
  } = {},
): Promise<SanitizeResult> {
  const mode = opts.mode ?? "keep";
  const srcUrl = URL.createObjectURL(file);

  try {
    const video = await loadVideo(srcUrl);
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
    const OUT_W =
      mode === "reencode" ? WIDTH : video.videoWidth || WIDTH;
    const OUT_H =
      mode === "reencode" ? HEIGHT : video.videoHeight || HEIGHT;

    // O elemento precisa estar no documento e "renderizável", senão alguns
    // navegadores não decodificam os frames e o resultado sai todo preto.
    video.style.position = "fixed";
    video.style.left = "0";
    video.style.bottom = "0";
    video.style.width = "2px";
    video.style.height = "2px";
    video.style.opacity = "0.01";
    video.style.pointerEvents = "none";
    video.style.zIndex = "-1";
    document.body.appendChild(video);

    // Mantemos o vídeo mudo no alto-falante (autoplay não é bloqueado assim),
    // mas o áudio continua disponível via captureStream do próprio elemento.
    video.muted = true;
    (video as any).defaultMuted = true;
    video.volume = 0;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      video.onseeked = finish;
      try {
        video.currentTime = 0;
      } catch {
        finish();
      }
      setTimeout(finish, 2000);
    });
    video.onseeked = null;

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    const stream = canvas.captureStream(FPS);
    // Áudio: pegamos direto do elemento (não usa AudioContext, não trava)
    let elementStream: MediaStream | null = null;
    try {
      const capture =
        (video as any).captureStream?.bind(video) ??
        (video as any).mozCaptureStream?.bind(video);
      if (capture) {
        elementStream = capture() as MediaStream;
        elementStream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
    } catch {
      elementStream = null;
    }

    const mimeType = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const outType = recorder.mimeType || mimeType;
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: outType }));
    });

    let thumbnailBase64 = "";
    let raf = 0;
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
      raf = requestAnimationFrame(tick);
    };

    // primeiro frame já desenhado antes de começar a gravar
    paint();
    try {
      await video.play();
    } catch {
      throw new Error(
        "O navegador bloqueou a reprodução do vídeo. Toque na tela e tente de novo.",
      );
    }
    tick();
    recorder.start(1000);

    // Espera o fim do vídeo, com rede de segurança caso 'ended' não dispare
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(watch);
        clearTimeout(hardStop);
        resolve();
      };
      video.onended = finish;
      const watch = setInterval(() => {
        if (video.ended || (duration && video.currentTime >= duration - 0.15))
          finish();
      }, 250);
      // limite: duração + 20s
      const hardStop = setTimeout(finish, (duration + 20) * 1000);
    });
    video.onended = null;

    cancelAnimationFrame(raf);
    // pequeno respiro pro último frame entrar no arquivo
    await new Promise((r) => setTimeout(r, 300));
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await done;
    try {
      elementStream?.getTracks().forEach((t) => t.stop());
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    video.remove();



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
    URL.revokeObjectURL(srcUrl);
  }
}
