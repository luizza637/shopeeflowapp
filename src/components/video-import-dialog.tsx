import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Shield, Sparkles, Copy, Share2, Download } from "lucide-react";
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
import { saveShopeeProductFromLink } from "@/lib/shopee-import.functions";
import {
  SOCIAL_PLATFORMS,
  platformInfo,
  type SocialPlatform,
} from "@/lib/social-caption";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeVideo } from "@/lib/video-sanitize";

/** Separa o texto colado em legenda + hashtags */
export function splitCaption(text: string) {
  const raw = (text ?? "").trim();
  if (!raw) return { caption: "", hashtags: "" };
  const tags = Array.from(
    new Set((raw.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.trim())),
  ).join(" ");
  const caption = raw
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { caption, hashtags: tags };
}

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
  const saveProductFromLink = useServerFn(saveShopeeProductFromLink);

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [productLink, setProductLink] = useState("");
  const [linkedProductName, setLinkedProductName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("shopee");
  const [caption, setCaption] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [cleanName, setCleanName] = useState("");
  const [cleanUrl, setCleanUrl] = useState<string | null>(null);

  const productMutation = useMutation({
    mutationFn: (url: string) => saveProductFromLink({ data: { url } }),
    onSuccess: (product) => {
      setProductId(product.id);
      setLinkedProductName(product.name);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto salvo na vitrine e vinculado ao vídeo");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não consegui ler esse link da Shopee"),
  });

  const reset = () => {
    setFile(null);
    setTitle("");
    setProductId("");
    setProductLink("");
    setLinkedProductName("");
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
    onOpenChange(false);
  };

  const linkProduct = () => {
    const url = productLink.trim();
    if (!url) return toast.error("Cole o link normal do produto da Shopee");
    productMutation.mutate(url);
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

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Escolha um vídeo");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      setStep("Limpando metadados sem cortar, comprimir ou alterar o vídeo…");
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

      const parts = splitCaption(caption);

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
          caption: parts.caption || undefined,
          hashtags: parts.hashtags || undefined,
        },
      });

      qc.invalidateQueries({ queryKey: ["videos"] });
      setCleanName(newName);
      if (cleanUrl) URL.revokeObjectURL(cleanUrl);
      const url = URL.createObjectURL(result.blob);
      setCleanUrl(url);

      // Baixa o vídeo limpo automaticamente, já com nome novo
      triggerDownload(url, newName);

      if (caption.trim()) {
        navigator.clipboard.writeText(caption.trim()).catch(() => {});
        toast.success("Vídeo limpo baixado e legenda copiada!");
      } else {
        toast.success("Metadados apagados e vídeo baixado!");
      }

      if (saved?.id) setSavedId(saved.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui importar esse vídeo");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  const downloadClean = () => {
    if (!cleanUrl) return;
    triggerDownload(cleanUrl, cleanName || "video.mp4");
  };

  const publish = (p: SocialPlatform) => {
    const info = platformInfo(p);
    if (caption.trim()) {
      navigator.clipboard.writeText(caption.trim()).catch(() => {});
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
            Cole aqui a legenda que você pegou no VidEx, escolha o vídeo e pronto:
            o arquivo é salvo sem cortes nem perda de qualidade, com metadados
            removidos, nome novo, baixado na hora e a legenda guardada junto do
            vídeo.
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
                  onClick={() => setPlatform(p.id)}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-caption">
              Legenda + hashtags (cole a do VidEx)
            </Label>
            <Textarea
              id="import-caption"
              value={caption}
              disabled={busy}
              rows={6}
              placeholder="Cole aqui a legenda com o link e as hashtags…"
              onChange={(e) => setCaption(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Ela fica salva junto do vídeo: aparece na aba Vídeos e já vem
              preenchida no agendamento.
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

          <div className="space-y-2">
            <Label htmlFor="import-product-link">Link do produto da Shopee</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="import-product-link"
                type="url"
                value={productLink}
                disabled={busy || productMutation.isPending}
                onChange={(event) => setProductLink(event.target.value)}
                onPaste={(event) => {
                  const value = event.clipboardData.getData("text").trim();
                  if (/^https?:\/\//i.test(value)) {
                    setProductLink(value);
                    setTimeout(() => productMutation.mutate(value), 0);
                  }
                }}
                placeholder="Cole somente o link normal da Shopee"
              />
              <Button
                type="button"
                variant="outline"
                onClick={linkProduct}
                disabled={busy || productMutation.isPending || !productLink.trim()}
              >
                {productMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vincular produto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {linkedProductName
                ? `Vinculado: ${linkedProductName}`
                : "A foto e os dados são puxados, o link de afiliado é criado automaticamente e o produto entra na sua vitrine."}
            </p>
          </div>

          {products.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ou escolha um produto já salvo</Label>
                <Select
                  value={productId}
                  onValueChange={(value) => {
                    setProductId(value);
                    setLinkedProductName(products.find((p) => p.id === value)?.name ?? "");
                  }}
                  disabled={busy}
                >
                  <SelectTrigger><SelectValue placeholder="Vincular a um produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
          )}

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
            <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium text-primary">
                Pronto! Vídeo limpo baixado e legenda salva para o{" "}
                {platformInfo(platform).label}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[160px] flex-1 truncate text-xs text-muted-foreground">
                  Novo nome: <span className="font-mono">{cleanName}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadClean}
                  disabled={!cleanUrl}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar novamente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!caption.trim()}
                  onClick={() => {
                    navigator.clipboard.writeText(caption.trim());
                    toast.success("Legenda copiada!");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar legenda
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
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
              Fechar e continuar depois
            </Button>
            {(file || caption || productLink) && !savedId && (
              <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
                Limpar
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={busy || productMutation.isPending || !file}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Apagar metadados e baixar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Upload };
