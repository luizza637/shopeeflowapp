import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Video,
  Trash2,
  Download,
  Loader2,
  Sparkles,
  Play,
  Copy,
  Package,
  CheckSquare,
  Square,
  Upload,
  ExternalLink,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listVideos, deleteVideo, getPostCopy } from "@/lib/videos.functions";
import { listProducts } from "@/lib/products.functions";
import { VideoStudioDialog } from "@/components/video-studio-dialog";
import { VideoImportDialog } from "@/components/video-import-dialog";
import { cn } from "@/lib/utils";
import {
  SOCIAL_PLATFORMS,
  buildCaption,
  platformInfo,
  type SocialPlatform,
} from "@/lib/social-caption";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({
    meta: [
      { title: "Vídeos — ShopeeFlow" },
      {
        name: "description",
        content:
          "Renderize vídeos verticais com narração IA, legendas sincronizadas e capa animada.",
      },
    ],
  }),
  component: VideosPage,
});

async function downloadUrl(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

const safeName = (s: string) =>
  (s || "video").normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) ||
  "video";

function VideosPage() {
  const list = useServerFn(listVideos);
  const listProds = useServerFn(listProducts);
  const del = useServerFn(deleteVideo);
  const postCopy = useServerFn(getPostCopy);
  const qc = useQueryClient();
  const [studioProduct, setStudioProduct] = useState<any | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform>("shopee");



  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: () => list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "all"],
    queryFn: () =>
      listProds({ data: { search: "", favoritesOnly: false, sort: "recent" } }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Vídeo removido");
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const startStudio = () => {
    if (!selectedProductId) {
      toast.error("Escolha um produto");
      return;
    }
    const p = products.find((x: any) => x.id === selectedProductId);
    if (!p) return;
    setStudioProduct(p);
    setPickerOpen(false);
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const videoLabel = (v: any) => v.title ?? v.products?.name ?? "video";

  const copyText = async (text: string, msg = "Legenda copiada!") => {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const captionFor = async (v: any, p: SocialPlatform = platform) => {
    const kit = await postCopy({ data: { videoId: v.id } });
    return buildCaption(p, kit);
  };

  const copyCaption = async (v: any) => {
    try {
      await copyText(
        await captionFor(v),
        `Legenda para ${platformInfo(platform).label} copiada!`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível montar a legenda");
    }
  };

  /** Copia a legenda da plataforma e abre a página de publicação */
  const postTo = async (v: any, p: SocialPlatform) => {
    const info = platformInfo(p);
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      await copyText(
        await captionFor(v, p),
        `Legenda copiada! Cole na publicação do ${info.label}.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui montar a legenda");
    }
    if (tab) tab.location.href = info.uploadUrl;
    else window.open(info.uploadUrl, "_blank", "noopener,noreferrer");
  };

  /** Baixa só o vídeo e copia a legenda salva com hashtags */
  const downloadVideo = async (v: any) => {
    setBusy(true);
    try {
      const base = safeName(videoLabel(v));
      await downloadUrl(v.url, `${base}.mp4`);
      const text = v.caption
        ? [v.caption, v.hashtags].filter(Boolean).join("\n\n")
        : buildCaption(platform, await postCopy({ data: { videoId: v.id } }));
      await copyText(text, "Vídeo baixado e legenda copiada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar o vídeo");
    } finally {
      setBusy(false);
    }
  };


  const downloadSelected = async () => {
    const items = videos.filter((v: any) => selected.includes(v.id));
    if (!items.length) return;
    setBusy(true);
    try {
      for (const v of items) {
        await downloadUrl(v.url, `${safeName(videoLabel(v))}.mp4`);
        await new Promise((r) => setTimeout(r, 700));
      }
      toast.success(`${items.length} vídeo(s) baixado(s)`);
    } catch {
      toast.error("Alguns downloads falharam");
    } finally {
      setBusy(false);
    }
  };

  const copySelectedCaptions = async () => {
    const items = videos.filter((v: any) => selected.includes(v.id));
    if (!items.length) return;
    setBusy(true);
    try {
      const parts: string[] = [];
      for (const v of items) {
        const kit = buildCaption(platform, await postCopy({ data: { videoId: v.id } }));
        parts.push(`— ${videoLabel(v)} —\n${kit}`);
      }
      await copyText(parts.join("\n\n"), "Legendas copiadas!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao copiar legendas");
    } finally {
      setBusy(false);
    }
  };



  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Vídeos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vertical 9:16 com zoom automático, legendas sincronizadas, narração IA
            e metadados removidos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/videx">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir VidEx
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar vídeo
          </Button>
          <Button
            onClick={() => setPickerOpen(true)}
            className="bg-gradient-primary shadow-glow hover:opacity-90"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Novo vídeo com IA
          </Button>
        </div>
      </header>


      {pickerOpen && (
        <div className="rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur-sm">
          <p className="mb-3 text-sm font-medium">Escolha um produto</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={startStudio}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              Abrir estúdio
            </Button>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Cancelar
            </Button>
          </div>
          {products.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Você ainda não tem produtos. Cadastre um em <b>Produtos</b> primeiro.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] animate-pulse rounded-2xl border border-border bg-surface/40"
            />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-semibold">
            Nenhum vídeo ainda
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Escolha um produto e gere o primeiro vídeo com narração e legendas
            automáticas.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar vídeo pronto
            </Button>
            <Button
              onClick={() => setPickerOpen(true)}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Novo vídeo com IA
            </Button>
          </div>
        </div>

      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/50 p-3 backdrop-blur-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelected((s) =>
                  s.length === videos.length ? [] : videos.map((v: any) => v.id),
                )
              }
            >
              {selected.length === videos.length && videos.length > 0 ? (
                <CheckSquare className="mr-2 h-4 w-4" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Selecionar tudo
            </Button>
            <span className="text-xs text-muted-foreground">
              {selected.length} selecionado(s)
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as SocialPlatform)}
              >
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.emoji} Legenda {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!selected.length || busy}
                onClick={copySelectedCaptions}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar legendas
              </Button>
              <Button
                size="sm"
                disabled={!selected.length || busy}
                onClick={downloadSelected}
                className="bg-gradient-primary shadow-glow hover:opacity-90"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Baixar selecionados
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {videos.map((v: any) => (
              <VideoCard
                key={v.id}
                video={v}
                selected={selected.includes(v.id)}
                onToggleSelect={() => toggleSelect(v.id)}
                busy={busy}
                onCopyCaption={() => copyCaption(v)}
                onPost={(p) => postTo(v, p)}
                onKit={() => downloadVideo(v)}
                onDelete={() => {
                  if (confirm("Remover este vídeo?")) delMut.mutate(v.id);
                }}
              />
            ))}
          </div>
        </>
      )}


      <VideoImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        products={products}
      />

      <VideoStudioDialog
        product={studioProduct}
        onClose={() => setStudioProduct(null)}

      />
    </div>
  );
}

function VideoCard({
  video,
  onDelete,
  selected,
  onToggleSelect,
  onCopyCaption,
  onPost,
  onKit,
  busy,
}: {
  video: any;
  onDelete: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  onCopyCaption: () => void;
  onPost: (p: SocialPlatform) => void;
  onKit: () => void;
  busy: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border bg-surface/60 backdrop-blur-sm transition-all hover:shadow-elevated",
        selected ? "border-primary shadow-glow" : "border-border hover:border-primary/50",
      )}
    >
      <div className="relative aspect-[9/16] bg-black">
        <button
          onClick={onToggleSelect}
          className={cn(
            "absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border backdrop-blur-sm transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/40 bg-black/40 text-white",
          )}
          aria-label={selected ? "Desmarcar vídeo" : "Selecionar vídeo"}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        {playing ? (
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <>
            {video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnail_url}
                alt={video.title ?? "Vídeo"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Video className="h-10 w-10 opacity-40" />
              </div>
            )}
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Reproduzir"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
                <Play className="h-7 w-7 translate-x-0.5 text-primary-foreground" />
              </div>
            </button>
          </>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-medium">
          {video.title ?? video.products?.name ?? "Sem título"}
        </p>
        <Button
          size="sm"
          disabled={busy}
          onClick={onKit}
          className="w-full bg-gradient-primary shadow-glow hover:opacity-90"
        >
          <Package className="mr-2 h-4 w-4" />
          Kit de post
        </Button>
        <div className="grid grid-cols-3 gap-1">
          {SOCIAL_PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPost(p.id)}
              title={`Copiar legenda e abrir ${p.label}`}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1.5 text-[11px] font-medium transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <span>{p.emoji}</span>
              <span className="truncate">
                {p.id === "instagram" ? "Reels" : p.id === "shopee" ? "Shopee" : "TikTok"}
              </span>
              <Share2 className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{video.duration_seconds ? `${video.duration_seconds}s` : ""}</span>
          <div className="flex gap-1">
            <button
              onClick={onCopyCaption}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:text-foreground"
              title="Copiar legenda + hashtags"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href={video.url}
              download
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:text-foreground"
              title="Baixar"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={onDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:text-destructive"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export { Loader2 };
