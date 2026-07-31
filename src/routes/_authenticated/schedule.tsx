import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Instagram,
  ShoppingBag,
  Music2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listVideos } from "@/lib/videos.functions";
import {
  listScheduledPosts,
  createScheduledPost,
  cancelScheduledPost,
  deleteScheduledPost,
} from "@/lib/schedule.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Agendamento — ShopeeFlow" },
      {
        name: "description",
        content: "Programe até 5 publicações por dia no TikTok, Instagram e Shopee.",
      },
    ],
  }),
  component: SchedulePage,
});

type Platform = "tiktok" | "instagram" | "shopee";

const PLATFORMS: Record<
  Platform,
  { label: string; icon: any; color: string; auto: boolean }
> = {
  tiktok: {
    label: "TikTok",
    icon: Music2,
    color: "text-pink-400",
    auto: true,
  },
  instagram: {
    label: "Instagram Reels",
    icon: Instagram,
    color: "text-fuchsia-400",
    auto: false,
  },
  shopee: {
    label: "Shopee Video",
    icon: ShoppingBag,
    color: "text-primary",
    auto: false,
  },
};

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: any }
> = {
  pending: {
    label: "Agendado",
    className: "bg-warning/10 text-warning border-warning/30",
    icon: Clock,
  },
  publishing: {
    label: "Publicando",
    className: "bg-primary/10 text-primary border-primary/30",
    icon: Loader2,
  },
  published: {
    label: "Publicado",
    className: "bg-success/10 text-success border-success/30",
    icon: CheckCircle2,
  },
  manual: {
    label: "Publicar manual",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    icon: ExternalLink,
  },
  failed: {
    label: "Falhou",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-border",
    icon: X,
  },
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SchedulePage() {
  const qc = useQueryClient();
  const listVids = useServerFn(listVideos);
  const listPosts = useServerFn(listScheduledPosts);
  const createPost = useServerFn(createScheduledPost);
  const cancelPost = useServerFn(cancelScheduledPost);
  const deletePost = useServerFn(deleteScheduledPost);

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: videos = [] } = useQuery({
    queryKey: ["videos"],
    queryFn: () => listVids(),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["scheduled_posts"],
    queryFn: () => listPosts(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelPost({ data: { id } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      qc.invalidateQueries({ queryKey: ["scheduled_posts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePost({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["scheduled_posts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const grouped = useMemo(() => {
    const upcoming: any[] = [];
    const done: any[] = [];
    for (const p of posts) {
      if (p.status === "pending" || p.status === "publishing") upcoming.push(p);
      else done.push(p);
    }
    return { upcoming, done };
  }, [posts]);

  const dailyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      if (p.status === "cancelled" || p.status === "failed") continue;
      const day = new Date(p.scheduled_at).toISOString().slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    return m;
  }, [posts]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-xs">
            <CalendarClock className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">
              Fase 5 — Agendamento & Publicação
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Calendário de <span className="text-gradient-primary">publicações</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Programe até 5 vídeos por dia. TikTok publica sozinho quando o
            conector estiver ativo.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-primary shadow-glow hover:opacity-90"
          disabled={videos.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo agendamento
        </Button>
      </div>

      {videos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted-foreground">
          Você ainda não tem vídeos. Gere um vídeo em Produtos antes de agendar.
        </div>
      )}

      {/* Upcoming */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Próximos</h2>
          <span className="text-xs text-muted-foreground">
            {grouped.upcoming.length} agendado(s)
          </span>
        </div>
        {grouped.upcoming.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
            Nada agendado ainda.
          </p>
        ) : (
          <div className="grid gap-3">
            {grouped.upcoming.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                onCancel={() => cancelMut.mutate(p.id)}
                onDelete={() => deleteMut.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Histórico</h2>
        {grouped.done.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
            Sem publicações concluídas ainda.
          </p>
        ) : (
          <div className="grid gap-3">
            {grouped.done.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                onCancel={() => cancelMut.mutate(p.id)}
                onDelete={() => deleteMut.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      <NewScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        videos={videos}
        dailyCounts={dailyCounts}
        onCreate={async (input) => {
          try {
            await createPost({ data: input });
            toast.success("Agendado!");
            qc.invalidateQueries({ queryKey: ["scheduled_posts"] });
            setDialogOpen(false);
          } catch (e: any) {
            toast.error(e.message ?? "Erro ao agendar");
          }
        }}
      />
    </div>
  );
}

function PostRow({
  post,
  onCancel,
  onDelete,
}: {
  post: any;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const platform = PLATFORMS[post.platform as Platform];
  const status = STATUS_META[post.status] ?? STATUS_META.pending;
  const Icon = platform.icon;
  const StatusIcon = status.icon;
  const title = post.videos?.title || post.products?.name || "Vídeo";
  const isFinal =
    post.status === "published" ||
    post.status === "failed" ||
    post.status === "cancelled" ||
    post.status === "manual";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-black">
          {post.videos?.thumbnail_url ? (
            <img
              src={post.videos.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1", platform.color)}>
              <Icon className="h-3.5 w-3.5" />
              {platform.label}
            </span>
            <span>•</span>
            <span>{formatDateTime(post.scheduled_at)}</span>
          </div>
          {post.error_message && (
            <p className="mt-1 line-clamp-2 text-xs text-destructive">
              {post.error_message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn("gap-1 border", status.className)}
        >
          <StatusIcon
            className={cn(
              "h-3 w-3",
              post.status === "publishing" && "animate-spin",
            )}
          />
          {status.label}
        </Badge>
        {(post.status === "manual" || post.status === "published") &&
          (post.external_url || post.products?.affiliate_url) && (
            <a
              href={post.external_url ?? post.products?.affiliate_url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-primary"
              title="Abrir"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        {!isFinal && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isFinal && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function NewScheduleDialog({
  open,
  onOpenChange,
  videos,
  dailyCounts,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videos: any[];
  dailyCounts: Map<string, number>;
  onCreate: (input: {
    videoId: string;
    platform: Platform;
    scheduledAt: string;
    caption?: string;
    hashtags?: string;
  }) => Promise<void>;
}) {
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setSeconds(0, 0);
    return toLocalInputValue(d);
  }, [open]);

  const [videoId, setVideoId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [when, setWhen] = useState<string>(defaultDate);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedDay = when ? new Date(when).toISOString().slice(0, 10) : "";
  const count = selectedDay ? (dailyCounts.get(selectedDay) ?? 0) : 0;
  const full = count >= 5;

  const submit = async () => {
    if (!videoId) return;
    setSubmitting(true);
    try {
      await onCreate({
        videoId,
        platform,
        scheduledAt: new Date(when).toISOString(),
        caption: caption.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
      });
      setVideoId("");
      setCaption("");
      setHashtags("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Escolha um vídeo, a plataforma e o horário. Máximo de 5 por dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vídeo</Label>
            <Select
              value={videoId}
              onValueChange={(id) => {
                setVideoId(id);
                const v = videos.find((x: any) => x.id === id);
                if (v) {
                  setCaption(v.caption ?? "");
                  setHashtags(v.hashtags ?? "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vídeo" />
              </SelectTrigger>
              <SelectContent>
                {videos.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.title || v.products?.name || "Vídeo sem título"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {videoId && (caption || hashtags) && (
              <p className="text-xs text-muted-foreground">
                Legenda e hashtags do vídeo já preenchidas abaixo — edite se quiser.
              </p>
            )}
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as Platform)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLATFORMS) as Platform[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PLATFORMS[k].label}
                      {!PLATFORMS[k].auto && " (manual)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          </div>

          {selectedDay && (
            <p
              className={cn(
                "text-xs",
                full ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {count}/5 agendamentos nesse dia
              {full && " — escolha outra data"}
            </p>
          )}

          <div className="space-y-2">
            <Label>Legenda (opcional)</Label>
            <Textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda que vai junto com o vídeo"
            />
          </div>

          <div className="space-y-2">
            <Label>Hashtags (opcional)</Label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#shopee #achadinhos"
            />
          </div>

          {!PLATFORMS[platform].auto && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-300">
              Publicação automática para {PLATFORMS[platform].label} ainda não
              está disponível. No horário marcado, o vídeo será colocado na fila
              como "publicar manual" com o link pronto para você postar.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!videoId || !when || full || submitting}
            className="bg-gradient-primary shadow-glow hover:opacity-90"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarClock className="mr-2 h-4 w-4" />
            )}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
