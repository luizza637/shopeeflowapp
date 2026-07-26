import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Shield, Sparkles } from "lucide-react";
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
import { sanitizeVideo, type SanitizeMode } from "@/lib/video-sanitize";

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
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  const reset = () => {
    setFile(null);
    setTitle("");
    setProductId("");
    setProgress(0);
    setStep("");
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
      setStep("Limpando metadados e ajustando 9:16…");
      const result = await sanitizeVideo(file, {
        fit,
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

      await saveRec({
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
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui importar esse vídeo");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar vídeo
          </DialogTitle>
          <DialogDescription>
            Baixou o vídeo em outro app (VidEx, CapCut, galeria)? Traga para cá:
            o app remove os metadados, ajusta para 9:16 e guarda na sua
            biblioteca com Kit de Post.
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
              <Label>Enquadramento</Label>
              <Select
                value={fit}
                onValueChange={(v) => setFit(v as "cover" | "contain")}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Preencher tela (corta)</SelectItem>
                  <SelectItem value="contain">
                    Vídeo inteiro (fundo desfocado)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              O vídeo é reprocessado no seu navegador em tempo real — por isso
              leva mais ou menos a duração do vídeo. Nenhum metadado original
              (autor, local, aparelho) é mantido.
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancelar
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
