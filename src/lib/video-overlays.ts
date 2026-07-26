// Balões chamativos desenhados no canvas e "queimados" no vídeo.

export type BalloonStyle = "shopee" | "neon" | "glass" | "sticker" | "promo";

export type OverlayPosition = "top" | "center" | "bottom";

export type Overlay = {
  id: string;
  kind: "price" | "text";
  text: string;
  style: BalloonStyle;
  position: OverlayPosition;
  startSec: number;
  endSec: number | null;
};

export const BALLOON_STYLES: {
  value: BalloonStyle;
  label: string;
  hint: string;
}[] = [
  { value: "shopee", label: "Laranja Shopee", hint: "Clássico de oferta" },
  { value: "neon", label: "Neon", hint: "Fundo escuro, borda brilhante" },
  { value: "glass", label: "Vidro", hint: "Discreto e elegante" },
  { value: "sticker", label: "Adesivo", hint: "Branco com contorno grosso" },
  { value: "promo", label: "Promo pisca", hint: "Vermelho com pulso" },
];

export const POSITION_LABELS: Record<OverlayPosition, string> = {
  top: "Topo",
  center: "Meio",
  bottom: "Rodapé",
};

export function newOverlay(kind: "price" | "text"): Overlay {
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind,
    text: kind === "price" ? "R$ 29,90" : "Link na bio 👉",
    style: kind === "price" ? "shopee" : "neon",
    position: kind === "price" ? "center" : "bottom",
    startSec: 0,
    endSec: null,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tailPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  s: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, bottom - 2);
  ctx.lineTo(cx + 14 * s, bottom - 2);
  ctx.lineTo(cx - 6 * s, bottom + 30 * s);
  ctx.closePath();
}

type Skin = {
  fill: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => string | CanvasGradient;
  text: string;
  border?: string;
  borderWidth?: number;
  glow?: string;
  shadow?: string;
};

function skinFor(style: BalloonStyle): Skin {
  switch (style) {
    case "neon":
      return {
        fill: () => "rgba(10,10,18,0.86)",
        text: "#F5F7FF",
        border: "#22D3EE",
        borderWidth: 4,
        glow: "rgba(34,211,238,0.85)",
      };
    case "glass":
      return {
        fill: () => "rgba(255,255,255,0.16)",
        text: "#FFFFFF",
        border: "rgba(255,255,255,0.55)",
        borderWidth: 3,
        shadow: "rgba(0,0,0,0.45)",
      };
    case "sticker":
      return {
        fill: () => "#FFFFFF",
        text: "#111318",
        border: "#111318",
        borderWidth: 7,
        shadow: "rgba(0,0,0,0.35)",
      };
    case "promo":
      return {
        fill: (ctx, x, y, w) => {
          const g = ctx.createLinearGradient(x, y, x + w, y);
          g.addColorStop(0, "#E11D48");
          g.addColorStop(1, "#F97316");
          return g;
        },
        text: "#FFFFFF",
        glow: "rgba(244,63,94,0.8)",
      };
    case "shopee":
    default:
      return {
        fill: (ctx, x, y, w, h) => {
          const g = ctx.createLinearGradient(x, y, x + w, y + h);
          g.addColorStop(0, "#FF7A1A");
          g.addColorStop(1, "#FF3D00");
          return g;
        },
        text: "#FFFFFF",
        border: "rgba(255,255,255,0.9)",
        borderWidth: 4,
        shadow: "rgba(0,0,0,0.4)",
      };
  }
}

function isVisible(o: Overlay, t: number) {
  if (t < (o.startSec || 0)) return false;
  if (o.endSec != null && t > o.endSec) return false;
  return true;
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  o: Overlay,
  w: number,
  h: number,
  t: number,
) {
  const text = (o.text || "").trim();
  if (!text) return;

  const s = w / 1080; // escala relativa
  const fontSize = (o.kind === "price" ? 92 : 60) * s;
  const padX = 46 * s;
  const padY = 28 * s;
  const skin = skinFor(o.style);

  ctx.save();
  ctx.font = `900 ${fontSize}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(text);
  const boxW = Math.min(w - 60 * s, metrics.width + padX * 2);
  const boxH = fontSize + padY * 2;

  const cx = w / 2;
  const cy =
    o.position === "top"
      ? h * 0.14
      : o.position === "center"
        ? h * 0.5
        : h * 0.84;

  // animação de entrada + pulso
  const local = Math.max(0, t - (o.startSec || 0));
  const pop = Math.min(1, local / 0.35);
  const ease = 1 - Math.pow(1 - pop, 3);
  const pulse =
    o.style === "promo" || o.kind === "price"
      ? 1 + Math.sin(t * 4.2) * 0.02
      : 1;
  const scale = (0.8 + 0.2 * ease) * pulse;
  ctx.globalAlpha = ease;
  ctx.translate(cx, cy);
  ctx.rotate(o.style === "sticker" ? -0.035 : 0);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const x = cx - boxW / 2;
  const y = cy - boxH / 2;
  const radius = o.style === "sticker" ? 28 * s : boxH / 2;

  if (skin.glow) {
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = 38 * s;
  } else if (skin.shadow) {
    ctx.shadowColor = skin.shadow;
    ctx.shadowBlur = 26 * s;
    ctx.shadowOffsetY = 8 * s;
  }

  if (o.kind === "text") {
    tailPath(ctx, cx, y + boxH, s);
    ctx.fillStyle = skin.fill(ctx, x, y, boxW, boxH);
    ctx.fill();
  }

  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fillStyle = skin.fill(ctx, x, y, boxW, boxH);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (skin.border) {
    ctx.strokeStyle = skin.border;
    ctx.lineWidth = (skin.borderWidth ?? 3) * s;
    ctx.stroke();
  }

  ctx.fillStyle = skin.text;
  ctx.fillText(text, cx, cy + 2 * s, boxW - padX * 1.5);
  ctx.restore();
}

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlays: Overlay[],
  timeSec: number,
) {
  for (const o of overlays) {
    if (isVisible(o, timeSec)) drawOne(ctx, o, width, height, timeSec);
  }
}
