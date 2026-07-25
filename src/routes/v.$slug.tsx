import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, ShoppingBag, Star, Share2, Eye, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPublicStorefront,
  trackStorefrontView,
  type PublicProduct,
} from "@/lib/storefront.functions";
import { generateCta } from "@/lib/product-cta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/v/$slug")({
  loader: ({ params }) => getPublicStorefront({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const name =
      loaderData?.profile?.storefront_title ||
      loaderData?.profile?.display_name ||
      "Vitrine de achados";
    const desc =
      loaderData?.profile?.storefront_bio ||
      "Meus achados favoritos da Shopee com link direto de compra.";
    const image = loaderData?.products?.[0]?.image_url;
    return {
      meta: [
        { title: `${name} — Vitrine de achados` },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: `${name} — Vitrine de achados` },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image && image.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  errorComponent: () => <Empty title="Não foi possível carregar esta vitrine" />,
  notFoundComponent: () => <Empty title="Vitrine não encontrada" />,
  component: StorefrontPage,
});

function Empty({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <ShoppingBag className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <Link to="/" className="text-sm text-primary underline">
        Voltar ao início
      </Link>
    </main>
  );
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ShopeeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-[0_6px_20px_-8px_var(--primary)]">
      <ShoppingBag className="h-3.5 w-3.5" />
      Shopee
    </span>
  );
}

function useVisitorHash() {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    try {
      let v = localStorage.getItem("sf_visitor");
      if (!v) {
        v = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("sf_visitor", v);
      }
      setHash(v);
    } catch {
      setHash("anon");
    }
  }, []);
  return hash;
}

function StorefrontPage() {
  const { profile, products } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const visitorHash = useVisitorHash();
  const [category, setCategory] = useState<string>("Todos");

  const list = (products ?? []) as PublicProduct[];

  useEffect(() => {
    if (!profile || !visitorHash) return;
    trackStorefrontView({
      data: {
        slug,
        visitorHash,
        referrer:
          typeof document !== "undefined" ? document.referrer || undefined : undefined,
      },
    }).catch(() => {});
  }, [profile, visitorHash, slug]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of list) if (p.category) set.add(p.category);
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [list]);

  const filtered = useMemo(
    () => (category === "Todos" ? list : list.filter((p) => p.category === category)),
    [list, category],
  );

  if (!profile) return <Empty title="Vitrine não encontrada" />;

  const name = profile.storefront_title || profile.display_name || "Meus achados";
  const initials = name.slice(0, 2).toUpperCase();

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-30"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, var(--primary) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-2xl px-4 pt-10">
        <header className="flex flex-col items-center text-center">
          <ShopeeBadge />
          <div className="mt-4 h-20 w-20 overflow-hidden rounded-full bg-primary/15 ring-2 ring-primary/40">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Foto de ${name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                {initials}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{name}</h1>
          {profile.storefront_bio && (
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {profile.storefront_bio}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={share}>
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Eye className="h-3.5 w-3.5" />
              {filtered.length} achados online
            </span>
          </div>
        </header>

        {categories.length > 1 && (
          <nav className="mt-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                  c === category
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </nav>
        )}

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Nenhum produto publicado nesta categoria.
            </p>
          )}
          {filtered.map((p) => {
            const href = p.affiliate_url || p.url || undefined;
            const Wrapper = href ? "a" : "div";
            const cta = generateCta(p);
            return (
              <Wrapper
                key={p.id}
                {...(href
                  ? { href, target: "_blank", rel: "noopener noreferrer sponsored" }
                  : {})}
                className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_16px_40px_-24px_var(--primary)] sm:flex-col"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-auto sm:w-full sm:aspect-square">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {!!p.discount_percent && (
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      -{p.discount_percent}%
                    </span>
                  )}
                  {p.category && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                      {p.category}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <h2 className="line-clamp-2 text-sm font-medium leading-snug">
                      {p.name}
                    </h2>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Flame className="h-3.5 w-3.5" />
                      {cta}
                    </p>
                    {p.rating != null && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        {Number(p.rating).toFixed(1)}
                        {p.shop_name ? ` · ${p.shop_name}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                      {p.price != null && (
                        <span className="text-base font-bold text-primary">
                          {brl(Number(p.price))}
                        </span>
                      )}
                      {p.original_price != null && (
                        <span className="text-xs text-muted-foreground line-through">
                          {brl(Number(p.original_price))}
                        </span>
                      )}
                    </div>
                    {href && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        Comprar <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Links de afiliado Shopee — posso receber comissão pelas compras.
        </footer>
      </div>
    </main>
  );
}
