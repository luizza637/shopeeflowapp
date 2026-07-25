import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Video,
  Mic,
  Sparkles,
  Download,
  Save,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateNarration } from "@/lib/tts.functions";
import { listGenerations, generateProductContent } from "@/lib/ai-content.functions";
import { saveVideoRecord } from "@/lib/videos.functions";
import { composeVideo, type ComposeResult } from "@/lib/video-composer";
import {
  generatePresenterScenes,
  buildPresenterPrompts,
  type PresenterScene,
} from "@/lib/presenter-scenes";


type Voice = "nova" | "alloy" | "echo" | "fable" | "onyx" | "shimmer";
type Duration = 15 | 30 | 60;

export function VideoStudioDialog({
  product,
  onClose,
}: {
  product: any | null;
  onClose: () => void;
}) {
  const open = !!product;
  const qc = useQueryClient();
  const listGens = useServerFn(listGenerations);
  const genContent = useServerFn(generateProductContent);
  const tts = useServerFn(generateNarration);
  const saveRec = useServerFn(saveVideoRecord);

  const [duration, setDuration] = useState<Duration>(30);
  const [voice, setVoice] = useState<Voice>("nova");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [cta, setCta] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const { data: generations = [] } = useQuery({
    queryKey: ["ai_generations", product?.id],
    queryFn: () => listGens({ data: { productId: product.id } }),
    enabled: !!product?.id,
  });

  const latest = useMemo(() => generations[0], [generations]);

  useEffect(() => {
    if (!open) return;
    if (latest && !generationId) {
      setGenerationId(latest.id);
      setScript(latest.script ?? "");
      setTitle(latest.title ?? "");
      setCta(latest.cta ?? "");
      setDuration((latest.duration_seconds as Duration) ?? 30);
    }
  }, [latest, open, generationId]);

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setNarrationUrl(null);
    setMusicUrl(null);
    setResult(null);
    setVideoUrl(null);
    setPreviewFrame(null);
    setProgress(0);
    setScript("");
    setTitle("");
    setCta("");
    setGenerationId(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const generateScript = async () => {
    setScriptLoading(true);
    try {
      const row = await genContent({
        data: {
          productId: product.id,
          tone: "divertido",
          durationSeconds: duration,
          language: "pt-BR",
        },
      });
      setGenerationId(row.id);
      setScript(row.script ?? "");
      setTitle(row.title ?? "");
      setCta(row.cta ?? "");
      qc.invalidateQueries({ queryKey: ["ai_generations"] });
      toast.success("Roteiro gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar roteiro");
    } finally {
      setScriptLoading(false);
    }
  };

  const cleanForNarration = (raw: string) => {
    return raw
      // remove bracketed/parenthetical stage directions: [pausa], (sorrindo), {música}
      .replace(/[\[\(\{][^\]\)\}]*[\]\)\}]/g, " ")
      // remove leading labels at start of a line: "Cena 1:", "Cena 1 -", "Narração:", "Gancho:", "CTA:", "Título:", "Legenda:", "Voz:"
      .replace(/^\s*(cena|narra[çc][ãa]o|narrador|gancho|cta|t[íi]tulo|legenda|voz|hook|scene|caption)\s*\d*\s*[:\-–—]\s*/gim, "")
      // inline "Cena N:" mid-text
      .replace(/\b(cena|narra[çc][ãa]o|gancho|cta|hook|scene)\s*\d+\s*[:\-–—]\s*/gi, "")
      // strip markdown/asterisks/quotes
      .replace(/[*_`"“”]/g, "")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
  };

  const generateVoice = async () => {
    const combined = [title, script, cta].filter(Boolean).join(". ");
    const cleaned = cleanForNarration(combined);
    if (!cleaned) {
      toast.error("Escreva ou gere um roteiro primeiro");
      return;
    }
    // Fit to target duration: ~2.6 palavras/segundo em pt-BR a velocidade 1.0
    const WPS = 2.6;
    const targetWords = Math.floor(duration * WPS);
    const words = cleaned.split(/\s+/);
    let finalText = cleaned;
    let speed = 1;
    if (words.length > targetWords) {
      const ratio = words.length / targetWords;
      if (ratio <= 1.5) {
        // acelera um pouco a fala
        speed = Math.min(1.5, ratio);
      } else {
        // trunca preservando fim (CTA) — mantém início e recorta meio
        const keepStart = Math.floor(targetWords * 0.65);
        const keepEnd = targetWords - keepStart;
        finalText = [
          ...words.slice(0, keepStart),
          ...words.slice(words.length - keepEnd),
        ].join(" ");
        speed = 1.15;
      }
    }
    setTtsLoading(true);
    try {
      const { base64, mime } = await tts({
        data: { text: finalText.slice(0, 3800), voice, format: "mp3", speed },
      });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      if (narrationUrl) URL.revokeObjectURL(narrationUrl);
      setNarrationUrl(URL.createObjectURL(blob));
      toast.success("Narração pronta");
    } catch (e: any) {
      toast.error(e.message ?? "Erro na narração");
    } finally {
      setTtsLoading(false);
    }
  };

  const render = async () => {
    if (!script.trim() && !title.trim()) {
      toast.error("Adicione um roteiro ou título");
      return;
    }
    setRendering(true);
    setProgress(0);
    setResult(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    try {
      const r = await composeVideo({
        imageUrl: product.image_url ?? null,
        captionsText: script || title,
        narrationUrl,
        musicUrl,
        durationSeconds: duration,
        title,
        cta,
        brand: product.shop_name || "Shopee",
        onProgress: (t, total) => setProgress(t / total),
        onFrame: (f) => setPreviewFrame(f),
      });
      setResult(r);
      setVideoUrl(URL.createObjectURL(r.blob));
      toast.success("Vídeo pronto! Assista e salve.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao renderizar vídeo");
    } finally {
      setRendering(false);
    }
  };

  const upload = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const ext = result.mimeType.includes("webm") ? "webm" : "mp4";
      const path = `${userId}/${product.id}/${Date.now()}-${Math.random()
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
          productId: product.id,
          generationId: generationId ?? undefined,
          title: title || product.name,
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
      toast.success("Vídeo salvo na biblioteca");
      handleClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar vídeo");
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${(title || product.name || "video").replace(/[^\w-]+/g, "_")}.webm`;
    a.click();
  };

  const onMusicPick = (file: File | null) => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(file ? URL.createObjectURL(file) : null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Estúdio de vídeo IA
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {product?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          {/* Controls */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duração</Label>
                <Select
                  value={String(duration)}
                  onValueChange={(v) => setDuration(Number(v) as Duration)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="60">60 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voz da narração</Label>
                <Select value={voice} onValueChange={(v) => setVoice(v as Voice)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">Nova (feminina)</SelectItem>
                    <SelectItem value="shimmer">Shimmer (feminina)</SelectItem>
                    <SelectItem value="alloy">Alloy (neutra)</SelectItem>
                    <SelectItem value="fable">Fable (masculina)</SelectItem>
                    <SelectItem value="onyx">Onyx (masculina)</SelectItem>
                    <SelectItem value="echo">Echo (masculina)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Título do vídeo</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={generateScript}
                  disabled={scriptLoading}
                >
                  {scriptLoading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                  )}
                  Gerar com IA
                </Button>
              </div>
              <Textarea
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Achado da Shopee que vale cada centavo!"
              />
            </div>

            <div className="space-y-2">
              <Label>Roteiro (usado como legenda e narração)</Label>
              <Textarea
                rows={6}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Cole ou gere um roteiro. Cada frase vira uma legenda sincronizada."
              />
            </div>

            <div className="space-y-2">
              <Label>Call-to-action</Label>
              <Textarea
                rows={2}
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Ex: Corre no link da bio!"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={generateVoice}
                disabled={ttsLoading}
              >
                {ttsLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="mr-2 h-4 w-4" />
                )}
                {narrationUrl ? "Regerar narração" : "Gerar narração IA"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => musicInputRef.current?.click()}
              >
                {musicUrl ? "Trocar música" : "Música (opcional)"}
              </Button>
              <input
                ref={musicInputRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => onMusicPick(e.target.files?.[0] ?? null)}
              />
            </div>

            {narrationUrl && (
              <audio src={narrationUrl} controls className="w-full" />
            )}

            <Button
              onClick={render}
              disabled={rendering}
              className="w-full bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {rendering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renderizando… {Math.round(progress * 100)}%
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Renderizar vídeo
                </>
              )}
            </Button>

            {videoUrl && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={upload}
                  disabled={saving}
                  className="flex-1 bg-gradient-primary shadow-glow hover:opacity-90"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar na biblioteca
                </Button>
                <Button variant="outline" onClick={downloadFile}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border bg-black">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : previewFrame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFrame}
                  alt="Prévia"
                  className="h-full w-full object-contain"
                />
              ) : product?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt=""
                  className="h-full w-full object-cover opacity-40"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  A prévia aparece aqui enquanto o vídeo é renderizado.
                </div>
              )}
              {rendering && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                  <div
                    className="h-full bg-gradient-primary transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Formato vertical 1080×1920 (9:16). Metadados originais são removidos
              na re-codificação WebM.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
