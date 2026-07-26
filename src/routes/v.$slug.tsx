import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

const SHOPEE_COUPONS_URL =
  "https://shopee.com.br/m/cupom-de-desconto?mmp_pid=an_18377100565&uls_trackid=564gujhm007g&gad_source=1&gad_campaignid=22786855170&gbraid=0AAAAACoEtRlOl-q6u7FIhC0-EDjjU09pm&gclid=CjwKCAjwvZHTBhAlEiwA1ug5P2Pq3fNqMZt11M6hv369aFi-BelAdFiuDT0ZnNJLhx5W6zod7Zl47BoCoJgQAvD_BwE";
import { ExternalLink, ShoppingBag, Star, Share2, Eye, Flame, Sparkles, Search, X, Ticket, Timer, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPublicStorefront,
  trackStorefrontView,
  trackProductClick,
  type PublicProduct,
} from "@/lib/storefront.functions";
import { generateCta } from "@/lib/product-cta";
import { getProductBadges, BADGE_TONE_CLASS } from "@/lib/product-badges";
import { playClickSound } from "@/lib/click-sound";
import { LivePurchaseFeed } from "@/components/live-purchase-feed";
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
    <span className="inline-flex animate-sf-glow items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
      <ShoppingBag className="h-3.5 w-3.5 animate-sf-wiggle" />
      Shopee
    </span>
  );
}

const TICKER = [
  "🔥 Ofertas atualizadas hoje",
  "⚡ Frete rápido pela Shopee",
  "💛 Achadinhos testados e aprovados",
  "⏳ Estoque limitado",
  "🏆 Os mais comprados da semana",
];

function Ticker() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-full border border-primary/25 bg-primary/5 py-2">
      <div className="flex w-max animate-sf-marquee gap-8 pr-8">
        {[...TICKER, ...TICKER].map((t, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-xs font-semibold text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnimatedBackdrop() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 7.3 + 4) % 96}%`,
        size: 6 + ((i * 13) % 18),
        delay: `${(i * 1.15) % 16}s`,
        duration: `${13 + ((i * 3) % 9)}s`,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="sf-grid-bg absolute inset-0 opacity-[0.18]" />
      <div
        className="animate-sf-blob absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "color-mix(in oklab, var(--primary) 35%, transparent)" }}
      />
      <div
        className="animate-sf-blob absolute -right-20 top-1/3 h-80 w-80 rounded-full blur-3xl"
        style={{
          background: "color-mix(in oklab, var(--primary) 22%, transparent)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="animate-sf-blob absolute bottom-0 left-1/4 h-64 w-64 rounded-full blur-3xl"
        style={{
          background: "color-mix(in oklab, var(--primary) 18%, transparent)",
          animationDelay: "-11s",
        }}
      />
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="animate-sf-drift absolute bottom-[-10vh] rounded-full bg-primary/40"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
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


/** Contador até a virada do dia (ofertas do dia) */
function useCountdown() {
  const [left, setLeft] = useState<number>(() => msUntilMidnight());
  useEffect(() => {
    const t = setInterval(() => setLeft(msUntilMidnight()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = Math.max(0, Math.floor(left / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function msUntilMidnight() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime() - now.getTime();
}

function StorefrontPage() {
  const { profile, products, clickCounts } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const visitorHash = useVisitorHash();
  const [category, setCategory] = useState<string>("Todos");
  const [query, setQuery] = useState("");
  const countdown = useCountdown();

  const clicks = (clickCounts ?? {}) as Record<string, number>;
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

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of list) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    m.set("Todos", list.length);
    return m;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((p) => {
        if (category !== "Todos" && p.category !== category) return false;
        if (!q) return true;
        return [p.name, p.category, p.shop_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      // Ranking: mais clicados primeiro (últimos 7 dias)
      .sort((a, b) => (clicks[b.id] ?? 0) - (clicks[a.id] ?? 0));
  }, [list, category, query, clicks]);

  // Achadinhos do dia: mais clicados; sem cliques, os de maior desconto
  const deals = useMemo(() => {
    const scored = [...list].sort((a, b) => {
      const c = (clicks[b.id] ?? 0) - (clicks[a.id] ?? 0);
      if (c !== 0) return c;
      return (Number(b.discount_percent) || 0) - (Number(a.discount_percent) || 0);
    });
    return scored.slice(0, 3);
  }, [list, clicks]);

  if (!profile) return <Empty title="Vitrine não encontrada" />;

  const name = profile.storefront_title || profile.display_name || "Meus achados";
  const initials = name.slice(0, 2).toUpperCase();


  const share = async () => {
    playClickSound();
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

  const registerClick = (p: PublicProduct) => {
    trackProductClick({
      data: { slug, productId: p.id, visitorHash: visitorHash ?? undefined },
    }).catch(() => {});
  };

  const productLink = (p: PublicProduct) =>
    p.affiliate_url || p.url || (typeof window !== "undefined" ? window.location.href : "");

  const productMessage = (p: PublicProduct) =>
    `😍 Olha esse achadinho: ${p.name}${
      p.price != null ? ` — só ${brl(Number(p.price))}` : ""
    }\n${productLink(p)}`;

  const shareOnWhatsApp = (p: PublicProduct) => {
    playClickSound();
    registerClick(p);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(productMessage(p))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const shareProduct = async (p: PublicProduct) => {
    playClickSound();
    const text = productMessage(p);
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, text, url: productLink(p) });
        return;
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Link do produto copiado!");
  };



  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-16">
      <AnimatedBackdrop />
      <div

        className="pointer-events-none absolute inset-x-0 top-0 h-72 animate-pulse opacity-30"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, var(--primary) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-2xl px-4 pt-16 pb-12">
        <header className="flex animate-sf-pop-in flex-col items-center text-center">
          <ShopeeBadge />
          <div className="mt-4 animate-sf-float">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-primary/15 ring-2 ring-primary/40 transition duration-300 hover:scale-105 hover:ring-4">
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
          </div>
          <h1 className="text-shimmer mt-4 text-2xl font-bold tracking-tight">{name}</h1>
          {profile.storefront_bio && (
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {profile.storefront_bio}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 transition hover:scale-105"
              onClick={share}
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
            <a
              href={SHOPEE_COUPONS_URL}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => playClickSound()}
              className="inline-flex animate-sf-glow items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition hover:scale-105 active:scale-95"
            >
              <Ticket className="h-3.5 w-3.5 animate-sf-wiggle" /> Cupons Shopee
            </a>
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

        <LivePurchaseFeed products={list} />


        <Ticker />

        {deals.length > 0 && (
          <section className="mt-6 animate-sf-pop-in rounded-3xl border border-primary/30 bg-primary/[0.06] p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-primary">
                <Flame className="h-4 w-4 animate-sf-wiggle" /> Achadinhos do dia
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary-foreground">
                <Timer className="h-3.5 w-3.5" /> termina em {countdown}
              </span>
            </div>
            <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {deals.map((p, i) => {
                const href = p.affiliate_url || p.url || undefined;
                return (
                  <div
                    key={`deal-${p.id}`}
                    className="flex w-40 shrink-0 flex-col rounded-2xl border border-border bg-card p-2.5 transition hover:-translate-y-1 hover:border-primary/60"
                  >
                    <a
                      {...(href
                        ? { href, target: "_blank", rel: "noopener noreferrer sponsored" }
                        : {})}
                      onClick={() => {
                        playClickSound();
                        registerClick(p);
                      }}
                      className="block flex-1"
                    >

                      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
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
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {i === 0 ? "🥇 Top 1" : `#${i + 1}`}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug">
                        {p.name}
                      </p>
                      {p.price != null && (
                        <p className="mt-1 text-sm font-bold text-primary">
                          {brl(Number(p.price))}
                        </p>
                      )}
                    </a>
                    <button
                      type="button"
                      onClick={() => shareOnWhatsApp(p)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
                    >
                      <MessageCircle className="h-3 w-3" /> Enviar
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}



        <div className="relative mt-6 animate-sf-pop-in">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto ou categoria..."
            aria-label="Buscar produtos"
            className="w-full rounded-full border border-border bg-card/80 py-2.5 pl-10 pr-10 text-sm outline-none backdrop-blur transition focus:border-primary/60 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => {
                playClickSound();
                setQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:scale-110 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>



        {categories.length > 1 && (
          <nav className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c, i) => (
              <button
                key={c}
                onClick={() => {
                  playClickSound();
                  setCategory(c);
                }}
                style={{ animationDelay: `${i * 45}ms` }}
                className={cn(
                  "shrink-0 animate-sf-pop-in rounded-full border px-4 py-1.5 text-xs font-semibold transition duration-200 hover:scale-105 active:scale-95",
                  c === category
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_var(--primary)]"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {c}
                <span className="ml-1.5 opacity-60">{counts.get(c) ?? 0}</span>
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
          {filtered.map((p, i) => {
            const href = p.affiliate_url || p.url || undefined;
            const Wrapper = href ? "a" : "div";
            const cta = generateCta(p);
            const badges = getProductBadges(p);
            const rankClicks = clicks[p.id] ?? 0;
            return (
              <div key={`${category}-${p.id}`} className="flex flex-col gap-1.5">
              <Wrapper
                {...(href
                  ? { href, target: "_blank", rel: "noopener noreferrer sponsored" }
                  : {})}
                onClick={() => {
                  playClickSound();
                  registerClick(p);
                }}
                style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
                className="group flex animate-sf-pop-in gap-3 rounded-2xl border border-border bg-card p-3 transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_20px_50px_-24px_var(--primary)] active:scale-[0.98] sm:flex-col"
              >

                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-auto sm:w-full sm:aspect-square">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110 group-hover:rotate-1"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {!!p.discount_percent && (
                    <span className="absolute left-1.5 top-1.5 animate-sf-glow rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      -{p.discount_percent}%
                    </span>
                  )}
                  {p.category && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                      {p.category}
                    </span>
                  )}
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/25 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                            BADGE_TONE_CLASS[b.tone],
                          )}
                        >
                          <span className="animate-sf-wiggle">{b.emoji}</span>
                          {b.label}
                        </span>
                      ))}
                    </div>
                    <h2 className="line-clamp-2 text-sm font-medium leading-snug">
                      {p.name}
                    </h2>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Flame className="h-3.5 w-3.5 animate-sf-wiggle" />
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
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition duration-200 group-hover:scale-105 group-hover:shadow-[0_10px_24px_-12px_var(--primary)]">
                        Comprar <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Wrapper>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => shareOnWhatsApp(p)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 py-1.5 text-[11px] font-bold text-primary transition hover:scale-[1.02] hover:bg-primary/20 active:scale-95"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => shareProduct(p)}
                  aria-label={`Compartilhar ${p.name}`}
                  className="inline-flex h-8 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:scale-105 hover:text-foreground"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                {rankClicks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
                    <Flame className="h-3 w-3 text-primary" />
                    {rankClicks}
                  </span>
                )}
              </div>
              </div>

            );
          })}
        </section>

        <footer className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Novidades toda semana — volte sempre!
        </footer>
      </div>
    </main>
  );
}

