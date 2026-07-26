import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Shield, Sparkles, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { saveVideoRecord, getPostCopy } from "@/lib/videos.functions";
import {
  SOCIAL_PLATFORMS,
  buildCaption,
  platformInfo,
  type SocialPlatform,
} from "@/lib/social-caption";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeVideo, type SanitizeMode } from "@/lib/video-sanitize";
import { VideoBalloonEditor } from "@/components/video-balloon-editor";
import { newOverlay, type Overlay } from "@/lib/video-overlays";

export function VideoImportDialog({
  open,
  onOpenChange,
  products = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products?: any[];
}) {
  const qc = useQueryClient();
  const saveRec = useServerFn(saveVideoRecord);
  const postCopy = useServerFn(getPostCopy);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [mode, setMode] = useState<SanitizeMode>("keep");
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("shopee");
  const [caption, setCaption] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitle("");
    setProductId("");
    setOverlays([]);
    setProgress(0);
    setStep("");
    setCaption("");
    setSavedId(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Escolha um vídeo");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      setStep(
        overlays.length
          ? "Aplicando balões no vídeo…"
          : mode === "keep"
            ? "Limpando metadados (sem alterar o vídeo)…"
            : "Reprocessando em 9:16…",
      );
      const result = await sanitizeVideo(file, {
        mode,
        overlays,
        onProgress: (r) => setProgress(r),
      });

      setStep("Enviando para a sua biblioteca…");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const ext = result.mimeType.includes("webm") ? "webm" : "mp4";
      const path = `${userId}/importados/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("product-videos")
        .upload(path, result.blob, {
          contentType: result.mimeType,
          upsert: false,
        });
      if (upErr) throw upErr;

      const saved: any = await saveRec({
        data: {
          productId: productId || undefined,
          title:
            title ||
            products.find((p) => p.id === productId)?.name ||
            file.name.replace(/\.[^.]+$/, ""),
          storagePath: path,
          durationSeconds: result.durationSeconds,
          width: result.width,
          height: result.height,
          mimeType: result.mimeType,
          sizeBytes: result.blob.size,
          thumbnailBase64: result.thumbnailBase64,
        },
      });

      qc.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Vídeo importado, sem metadados e pronto para postar!");

      if (saved?.id) {
        setSavedId(saved.id);
        try {
          const kit = await postCopy({ data: { videoId: saved.id } });
          const text = buildCaption(platform, kit);
          setCaption(text);
          await navigator.clipboard.writeText(text).catch(() => {});
        } catch {
          setCaption("");
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui importar esse vídeo");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  const regenerate = async (p: SocialPlatform) => {
    setPlatform(p);
    if (!savedId) return;
    try {
      const kit = await postCopy({ data: { videoId: savedId } });
      setCaption(buildCaption(p, kit));
    } catch {
      /* ignore */
    }
  };

  const publish = (p: SocialPlatform) => {
    const info = platformInfo(p);
    if (caption) {
      navigator.clipboard.writeText(caption).catch(() => {});
      toast.success(`Legenda copiada! Cole na publicação do ${info.label}.`);
    }
    window.open(info.uploadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar vídeo
          </DialogTitle>
          <DialogDescription>
            Baixou o vídeo em outro app (VidEx, CapCut, galeria)? Traga para cá:
            por padrão o vídeo é salvo exatamente como está, sem cortes nem
            perda de qualidade, apenas sem os metadados do arquivo.
          </DialogDescription>

        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">Arquivo de vídeo</Label>
            <Input
              id="import-file"
              ref={inputRef}
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-title">Título (opcional)</Label>
            <Input
              id="import-title"
              value={title}
              disabled={busy}
              placeholder="Ex.: Fone bluetooth achadinho"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Produto (opcional)</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v);
                  const p = products.find((x: any) => x.id === v);
                  const price = p?.price ?? p?.current_price;
                  if (price && !overlays.some((o) => o.kind === "price")) {
                    setOverlays((prev) => [
                      ...prev,
                      {
                        ...newOverlay("price"),
                        text: `R$ ${Number(price)
                          .toFixed(2)
                          .replace(".", ",")}`,
                      },
                    ]);
                  }
                }}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Processamento</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as SanitizeMode)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">
                    Manter original (só limpar)
                  </SelectItem>
                  <SelectItem value="reencode">
                    Reprocessar em 9:16
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {mode === "keep"
                ? "O vídeo é enviado igual ao original — mesma duração, resolução e qualidade. Só os dados do arquivo (nome, data, origem) não vão junto."
                : "O vídeo é reprocessado no navegador em tempo real (leva a duração do vídeo) e forçado para 1080x1920."}
            </span>
          </div>


          <VideoBalloonEditor
            file={file}
            overlays={overlays}
            onChange={setOverlays}
            disabled={busy}
          />

          {busy && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{step}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Legenda pronta para</Label>
            <Select
              value={platform}
              onValueChange={(v) => regenerate(v as SocialPlatform)}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ao importar, a legenda com hashtags é gerada e copiada automaticamente.
            </p>
          </div>

          {savedId && (
            <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                className="text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(caption);
                    toast.success("Legenda copiada!");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar legenda
                </Button>
                {SOCIAL_PLATFORMS.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={p.id === platform ? "default" : "outline"}
                    onClick={() => publish(p.id)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Postar no {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              {savedId ? "Fechar" : "Cancelar"}
            </Button>
            <Button
              onClick={handleImport}
              disabled={busy || !file}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Importar e limpar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
