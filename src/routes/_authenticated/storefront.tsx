import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Store,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  getMyStorefront,
  updateStorefront,
  setProductPublic,
} from "@/lib/storefront.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/storefront")({
  head: () => ({
    meta: [
      { title: "Vitrine — ShopeeFlow" },
      {
        name: "description",
        content:
          "Monte sua vitrine de afiliada estilo Linktree e compartilhe um link único com seus produtos Shopee.",
      },
      { property: "og:title", content: "Vitrine — ShopeeFlow" },
      {
        property: "og:description",
        content: "Monte sua vitrine de afiliada e compartilhe com um único link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorefrontAdmin,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function StorefrontAdmin() {
  const load = useServerFn(getMyStorefront);
  const save = useServerFn(updateStorefront);
  const togglePublic = useServerFn(setProductPublic);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["storefront"],
    queryFn: () => load({}),
  });

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    setSlug(data.profile.slug ?? slugify(data.profile.display_name ?? "minha-vitrine"));
    setTitle(data.profile.storefront_title ?? "");
    setBio(data.profile.storefront_bio ?? "");
    setPublished(!!data.profile.storefront_published);
  }, [data?.profile]);

  const publicUrl = useMemo(
    () =>
      typeof window !== "undefined" && slug
        ? `${window.location.origin}/v/${slug}`
        : "",
    [slug],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          slug,
          storefront_title: title,
          storefront_bio: bio,
          storefront_published: published,
        },
      }),
    onSuccess: () => {
      toast.success("Vitrine atualizada!");
      qc.invalidateQueries({ queryKey: ["storefront"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  const publicMutation = useMutation({
    mutationFn: (v: { id: string; value: boolean }) => togglePublic({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storefront"] }),
    onError: () => toast.error("Não foi possível atualizar o produto"),
  });

  const products = data?.products ?? [];
  const visible = products.filter((p: any) => p.is_public).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Store className="h-6 w-6 text-primary" /> Vitrine
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha os produtos, publique e compartilhe um link único — as pessoas veem
          as imagens e compram pelo seu link de afiliada.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">Endereço da vitrine</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/v/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="minha-vitrine"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Achados da Duda"
              maxLength={80}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Descrição</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Meus achadinhos favoritos da Shopee, com cupom e frete grátis 💸"
            maxLength={300}
            rows={3}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-3">
            <Switch checked={published} onCheckedChange={setPublished} id="pub" />
            <Label htmlFor="pub" className="cursor-pointer">
              {published ? "Vitrine publicada" : "Vitrine desativada"}
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!publicUrl}
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!publicUrl}
              asChild
            >
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir
              </a>
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || slug.length < 3}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </div>
        </div>
        {publicUrl && (
          <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Produtos na vitrine</h2>
          <Badge variant="secondary">{visible} visíveis</Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Cadastre produtos na página Produtos para montar sua vitrine.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => (
              <div
                key={p.id}
                className={cn(
                  "flex gap-3 rounded-2xl border p-3 transition",
                  p.is_public
                    ? "border-primary/50 bg-card"
                    : "border-border bg-card/50 opacity-70",
                )}
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    {p.price != null ? (
                      <span className="text-sm font-bold text-primary">
                        {brl(Number(p.price))}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() =>
                        publicMutation.mutate({ id: p.id, value: !p.is_public })
                      }
                    >
                      {p.is_public ? (
                        <>
                          <Eye className="h-4 w-4 text-primary" /> Visível
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4" /> Oculto
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
