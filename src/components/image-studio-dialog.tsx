import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Download, ImagePlus, Wand2, Upload, X } from "lucide-react";
import { streamImage } from "@/lib/stream-image";
import { saveGeneratedImage } from "@/lib/images.functions";
import { cn } from "@/lib/utils";

type Mode = "generate" | "edit";

export function ImageStudioDialog({
  product,
  onClose,
}: {
  product: any | null;
  onClose: () => void;
}) {
  const open = !!product;
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [attach, setAttach] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [refs, setRefs] = useState<string[]>([]);
  const qc = useQueryClient();
  const save = useServerFn(saveGeneratedImage);

  const suggestedPrompt = () => {
    const parts = [
      product?.name,
      product?.category ? `categoria ${product.category}` : null,
      "fundo minimalista, iluminação de estúdio, alta qualidade, foto de produto vertical 9:16",
    ]
      .filter(Boolean)
      .join(", ");
    return parts;
  };

  const allRefs = () => {
    const list: string[] = [];
    if (mode === "edit" && product?.image_url) list.push(product.image_url);
    list.push(...refs);
    return list;
  };

  const canEdit = mode === "edit" && allRefs().length > 0;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 4);
    const read = await Promise.all(
      picked.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("Falha ao ler imagem"));
            r.readAsDataURL(f);
          }),
      ),
    );
    setRefs((v) => [...v, ...read].slice(0, 4));
    setMode("edit");
  };

  const run = async () => {
    const finalPrompt = prompt.trim() || suggestedPrompt();
    if (!finalPrompt) return;
    setPreview(null);
    setIsFinal(false);
    setIsStreaming(true);
    try {
      const refList = allRefs();
      await streamImage(
        "/api/generate-image",
        {
          prompt: refList.length
            ? `${finalPrompt}. Mantenha o produto EXATAMENTE igual às imagens de referência: mesmo formato, mesmas cores, mesmos detalhes e mesma marca. Apenas mude cenário, iluminação e enquadramento.`
            : finalPrompt,
          imageUrls: refList,
        },
        (dataUrl, final) => {
          setPreview(dataUrl);
          if (final) setIsFinal(true);
        },
      );
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar imagem");
    } finally {
      setIsStreaming(false);
    }
  };


  const saveMutation = useMutation({
    mutationFn: async (attachToProduct: boolean) => {
      if (!preview) throw new Error("Nenhuma imagem para salvar");
      return save({
        data: {
          productId: product.id,
          base64: preview,
          attachToProduct,
        },
      });
    },
    onSuccess: (_r, attachToProduct) => {
      toast.success(
        attachToProduct
          ? "Imagem salva e definida como capa do produto"
          : "Imagem salva na sua biblioteca",
      );
      qc.invalidateQueries({ queryKey: ["products"] });
      if (attachToProduct) onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = `${(product?.name ?? "imagem").replace(/[^\w-]+/g, "_")}.png`;
    a.click();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPreview(null);
          setPrompt("");
          setIsFinal(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Estúdio de imagens IA
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          {/* Controls */}
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-border bg-surface/40 p-1">
              <button
                onClick={() => setMode("generate")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  mode === "generate"
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Gerar nova
              </button>
              <button
                onClick={() => setMode("edit")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  mode === "edit"
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Usar referência
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-surface/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Imagens de referência (o produto real)</Label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary/50">
                  <Upload className="h-3.5 w-3.5" />
                  Enviar foto
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "edit" && product?.image_url && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-primary/40">
                    <img
                      src={product.image_url}
                      alt="Imagem atual do produto"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {refs.map((r, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-border"
                  >
                    <img src={r} alt={`Referência ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setRefs((v) => v.filter((_, j) => j !== i))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {allRefs().length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Envie fotos do produto real (ou use a imagem atual) para a IA manter o formato e
                    as cores fiéis.
                  </p>
                )}
              </div>
            </div>


            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "edit"
                    ? "Ex: aumentar brilho, fundo laranja gradiente, estilo TikTok..."
                    : suggestedPrompt()
                }
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  "fundo laranja gradiente",
                  "estilo cinemático",
                  "close-up produto",
                  "vertical 9:16",
                  "iluminação suave",
                ].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setPrompt((v) => (v.trim() ? `${v.trim()}, ${p}` : p))
                    }
                    className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={run}
              disabled={isStreaming || (mode === "edit" && !product?.image_url)}
              className="w-full bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {canEdit ? "Melhorar imagem" : "Gerar imagem"}
                </>
              )}
            </Button>

            {preview && isFinal && (
              <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Definir como capa do produto</p>
                    <p className="text-xs text-muted-foreground">
                      Substitui a imagem atual pela gerada.
                    </p>
                  </div>
                  <Switch checked={attach} onCheckedChange={setAttach} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => saveMutation.mutate(attach)}
                    disabled={saveMutation.isPending}
                    className="flex-1 bg-gradient-primary shadow-glow hover:opacity-90"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-2 h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={download}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface/40">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview"
                className={cn(
                  "h-full w-full object-contain transition-[filter] duration-500",
                  isFinal ? "blur-0" : "blur-xl",
                )}
              />
            ) : mode === "edit" && product?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt="Original"
                className="h-full w-full object-contain opacity-70"
              />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
                Escreva o prompt e clique em gerar. A imagem aparece aqui em tempo real.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
