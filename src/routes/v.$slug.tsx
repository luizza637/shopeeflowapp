import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, ShoppingBag, Star, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPublicStorefront } from "@/lib/storefront.functions";

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

function StorefrontPage() {
  const { profile, products } = Route.useLoaderData();

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
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <header className="flex flex-col items-center text-center">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-primary/15 ring-2 ring-primary/40">
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
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={share}>
            <Share2 className="h-4 w-4" /> Compartilhar vitrine
          </Button>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Nenhum produto publicado ainda.
            </p>
          )}
          {products.map((p) => {
            const href = p.affiliate_url || p.url || undefined;
            const Wrapper = href ? "a" : "div";
            return (
              <Wrapper
                key={p.id}
                {...(href
                  ? { href, target: "_blank", rel: "noopener noreferrer sponsored" }
                  : {})}
                className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/50 hover:bg-card/80 sm:flex-col"
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
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <h2 className="line-clamp-2 text-sm font-medium leading-snug">
                      {p.name}
                    </h2>
                    {p.rating != null && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
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
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        Ver <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Links de afiliado — posso receber comissão pelas compras.
        </footer>
      </div>
    </main>
  );
}
