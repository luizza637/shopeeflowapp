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
import { saveVideoRecord } from "@/lib/videos.functions";
import {
  SOCIAL_PLATFORMS,
  platformInfo,
  type SocialPlatform,
} from "@/lib/social-caption";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeVideo } from "@/lib/video-sanitize";

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
  
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("shopee");
  const [caption, setCaption] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [cleanName, setCleanName] = useState("");
  const [cleanUrl, setCleanUrl] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitle("");
    setProductId("");
    setProgress(0);
    setStep("");
    setCaption("");
    setSavedId(null);
    setCleanName("");
    if (cleanUrl) URL.revokeObjectURL(cleanUrl);
    setCleanUrl(null);
  };


  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  /** Nome novo e aleatório, com a data de hoje — como se o arquivo tivesse nascido agora. */
  const freshName = (ext: string) => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
      d.getMinutes(),
    )}${p(d.getSeconds())}`;
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `VID_${stamp}_${rand}.${ext}`;
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
        "Limpando metadados sem cortar, comprimir ou alterar o vídeo…",
      );
      const result = await sanitizeVideo(file, {
        mode: "keep",
        overlays: [],
        onProgress: (r) => setProgress(r),
      });

      setStep("Enviando para a sua biblioteca…");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const ext = result.mimeType.includes("webm") ? "webm" : "mp4";
      const newName = freshName(ext);
      const path = `${userId}/importados/${newName}`;

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
            newName.replace(/\.[^.]+$/, ""),
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
      setCleanName(newName);
      if (cleanUrl) URL.revokeObjectURL(cleanUrl);
      setCleanUrl(URL.createObjectURL(result.blob));
      toast.success("Metadados apagados e arquivo renomeado!");

      if (saved?.id) {
        setSavedId(saved.id);
        setCaption("");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui importar esse vídeo");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  const downloadClean = () => {
    if (!cleanUrl) return;
    const a = document.createElement("a");
    a.href = cleanUrl;
    a.download = cleanName || "video.mp4";
    a.click();
  };


  const regenerate = (p: SocialPlatform) => {
    setPlatform(p);
  };

  const publish = (p: SocialPlatform) => {
    const info = platformInfo(p);
    if (caption.trim()) {
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
            <Shield className="h-5 w-5 text-primary" />
            Apagar metadados
          </DialogTitle>
          <DialogDescription>
            Baixou o vídeo no VidEx? Traga para cá: o arquivo é salvo exatamente
            como está — sem cortes, sem perda de qualidade — apenas com os
            metadados removidos. A legenda você escreve do seu jeito.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Onde você vai postar?</Label>
            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_PLATFORMS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant={p.id === platform ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => regenerate(p.id)}
                  className={
                    p.id === platform
                      ? "bg-gradient-primary shadow-glow hover:opacity-90"
                      : ""
                  }
                >
                  <span className="mr-1">{p.emoji}</span>
                  <span className="truncate">{p.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Depois de salvar, você escreve a legenda no espaço em branco e o
              botão “Postar” leva direto para o upload dessa rede.
            </p>
          </div>

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
                onValueChange={setProductId}
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
              <div className="flex min-h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                Apagar metadados somente
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              O vídeo é enviado igual ao original — mesma duração, resolução e
              qualidade. Só os dados do arquivo, como nome, data e origem, não
              vão junto.
            </span>
          </div>

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

          {savedId && (
            <p className="text-sm font-medium text-primary">
              Pronto! Escreva sua legenda abaixo para o {platformInfo(platform).label}.
            </p>
          )}

          {savedId && (
            <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                placeholder="Escreva aqui a sua legenda…"
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
              Apagar metadados
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
