import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Tag, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BALLOON_STYLES,
  BALLOON_ANIMS,
  PHRASE_PRESETS,
  POSITION_LABELS,

  drawOverlays,
  newOverlay,
  type BalloonAnim,
  type BalloonStyle,
  type Overlay,
  type OverlayPosition,

} from "@/lib/video-overlays";

export function VideoBalloonEditor({
  file,
  overlays,
  onChange,
  disabled,
}: {
  file: File | null;
  overlays: Overlay[];
  onChange: (o: Overlay[]) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // carrega o vídeo e desenha o frame escolhido
  useEffect(() => {
    if (!url) return;
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    videoRef.current = v;
    v.onloadedmetadata = () => {
      setDuration(v.duration || 0);
      v.currentTime = Math.min(0.1, (v.duration || 1) / 4);
    };
    return () => {
      v.src = "";
      videoRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const w = v.videoWidth || 1080;
      const h = v.videoHeight || 1920;
      const scale = 420 / h;
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      } catch {
        /* ignore */
      }
      drawOverlays(ctx, canvas.width, canvas.height, overlays, time + 1);
    };
    v.onseeked = render;
    if (v.readyState >= 2) render();
    return () => {
      cancelled = true;
    };
  }, [overlays, time, duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 1) {
      try {
        v.currentTime = Math.min(time, Math.max(0, (v.duration || 1) - 0.05));
      } catch {
        /* ignore */
      }
    }
  }, [time]);

  const update = (id: string, patch: Partial<Overlay>) =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  if (!file) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">Balões no vídeo</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange([...overlays, newOverlay("price")])}
          >
            <Tag className="mr-1 h-3.5 w-3.5" /> Preço
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange([...overlays, newOverlay("text")])}
          >
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Frase
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <canvas
          ref={canvasRef}
          className="max-h-[420px] rounded-lg border border-border bg-black"
        />
        {duration > 0 && (
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.1}
            value={time}
            disabled={disabled}
            onChange={(e) => setTime(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label="Pré-visualizar em outro momento do vídeo"
          />
        )}
      </div>

      {overlays.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Adicione um balão de preço ou uma frase (ex.: "Link na bio") e ele já
          entra gravado no vídeo.
        </p>
      )}

      {overlays.map((o) => (
        <div key={o.id} className="space-y-2 rounded-lg border border-border/70 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={o.text}
              disabled={disabled}
              placeholder={o.kind === "price" ? "R$ 29,90" : "Clique no link 👇"}
              onChange={(e) => update(o.id, { text: e.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(overlays.filter((x) => x.id !== o.id))}
              aria-label="Remover balão"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {o.kind === "text" && (
            <div className="flex flex-wrap gap-1.5">
              {PHRASE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => update(o.id, { text: p })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    o.text === p
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Select
              value={o.anim ?? "bounce"}
              disabled={disabled}
              onValueChange={(v) => update(o.id, { anim: v as BalloonAnim })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BALLOON_ANIMS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={o.style}
              disabled={disabled}
              onValueChange={(v) => update(o.id, { style: v as BalloonStyle })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BALLOON_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={o.position}
              disabled={disabled}
              onValueChange={(v) =>
                update(o.id, { position: v as OverlayPosition })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["top", "center", "bottom"] as OverlayPosition[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {POSITION_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step={0.5}
              className="h-9 text-xs"
              disabled={disabled}
              value={o.startSec}
              onChange={(e) =>
                update(o.id, { startSec: Math.max(0, Number(e.target.value)) })
              }
              placeholder="Início (s)"
              aria-label="Segundo em que o balão aparece"
            />
            <Input
              type="number"
              min={0}
              step={0.5}
              className="h-9 text-xs"
              disabled={disabled}
              value={o.endSec ?? ""}
              onChange={(e) =>
                update(o.id, {
                  endSec: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Fim (s)"
              aria-label="Segundo em que o balão some"
            />
          </div>
        </div>
      ))}

      {overlays.length > 0 && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Plus className="h-3 w-3" />
          Com balões o vídeo é regravado no navegador (leva o tempo do vídeo),
          mantendo a resolução e a duração originais.
        </p>
      )}
    </div>
  );
}
