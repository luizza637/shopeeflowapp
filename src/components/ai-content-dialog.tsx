import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Wand2, Loader2, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  generateProductContent,
  listGenerations,
} from "@/lib/ai-content.functions";
import { cn } from "@/lib/utils";

type Tone = "divertido" | "urgente" | "informativo" | "emocional" | "profissional";
type Duration = 15 | 30 | 60;

export function AiContentDialog({
  product,
  onClose,
}: {
  product: any | null;
  onClose: () => void;
}) {
  const open = !!product;
  const [tone, setTone] = useState<Tone>("divertido");
  const [duration, setDuration] = useState<Duration>(30);
  const [extra, setExtra] = useState("");
  const qc = useQueryClient();

  const generate = useServerFn(generateProductContent);
  const list = useServerFn(listGenerations);

  const historyQuery = useQuery({
    queryKey: ["ai-generations", product?.id],
    queryFn: () => list({ data: { productId: product!.id } }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setExtra("");
    }
  }, [open, product?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      generate({
        data: {
          productId: product!.id,
          tone,
          durationSeconds: duration,
          extraNotes: extra || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Conteúdo gerado!");
      qc.invalidateQueries({ queryKey: ["ai-generations", product?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar conteúdo"),
  });

  const latest = historyQuery.data?.[0];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Gerar conteúdo com IA
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {product?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-xl border border-border bg-surface/40 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Tom</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="divertido">Divertido</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="informativo">Informativo</SelectItem>
                <SelectItem value="emocional">Emocional</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="flex items-end">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Gerar agora
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Contexto extra (opcional)</Label>
            <Textarea
              rows={2}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Ex: focar no público mãe de primeira viagem; destacar frete grátis..."
            />
          </div>
        </div>

        {historyQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
          </div>
        ) : latest ? (
          <GenerationView generation={latest} historyCount={historyQuery.data?.length ?? 0} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 py-10 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              Ainda não há conteúdo gerado. Ajuste o tom e clique em <b>Gerar agora</b>.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GenerationView({
  generation,
  historyCount,
}: {
  generation: any;
  historyCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Última geração</Badge>
        {generation.tone && <Badge variant="outline">{generation.tone}</Badge>}
        {generation.duration_seconds && (
          <Badge variant="outline">{generation.duration_seconds}s</Badge>
        )}
        {historyCount > 1 && (
          <span>{historyCount} variações salvas</span>
        )}
      </div>

      <Tabs defaultValue="script">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="script">Roteiro</TabsTrigger>
          <TabsTrigger value="hook">Gancho</TabsTrigger>
          <TabsTrigger value="cta">CTA</TabsTrigger>
          <TabsTrigger value="caption">Legenda</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="titles">Títulos</TabsTrigger>
          <TabsTrigger value="description">Descrição</TabsTrigger>
        </TabsList>
        <TabsContent value="script">
          <CopyBlock text={generation.script} />
        </TabsContent>
        <TabsContent value="hook">
          <CopyBlock text={generation.hook} />
        </TabsContent>
        <TabsContent value="cta">
          <CopyBlock text={generation.cta} />
        </TabsContent>
        <TabsContent value="caption">
          <CopyBlock text={generation.caption} />
        </TabsContent>
        <TabsContent value="hashtags">
          <CopyBlock text={generation.hashtags} />
        </TabsContent>
        <TabsContent value="titles">
          <div className="space-y-2">
            {(generation.titles ?? []).map((t: string, i: number) => (
              <CopyBlock key={i} text={t} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="description">
          <CopyBlock text={generation.description} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="group relative rounded-xl border border-border bg-surface/60 p-4">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
        {text || "—"}
      </pre>
      <button
        onClick={copy}
        className={cn(
          "absolute right-2 top-2 rounded-md border border-border bg-surface p-1.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
          copied && "opacity-100 text-success",
        )}
        title="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
