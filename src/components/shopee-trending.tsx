import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flame, Loader2, Plus, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchShopeeOffers, importShopeeOffer } from "@/lib/shopee.functions";
import { cn } from "@/lib/utils";

type Offer = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  sales: number | null;
  discountPercent: number | null;
  commissionPercent: number | null;
  rating: number | null;
  shopName: string | null;
  offerLink: string | null;
  productLink: string | null;
};

const brl = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// sortType da Shopee: 2 = mais vendidos, 4 = menor preço, 5 = maior comissão
const TABS = [
  { key: "sales", label: "Mais vendidos", sortType: 2 },
  { key: "commission", label: "Maior comissão", sortType: 5 },
  { key: "price", label: "Menor preço", sortType: 4 },
] as const;

const sortOffers = (list: Offer[], key: (typeof TABS)[number]["key"]): Offer[] => {
  const arr = [...list];
  const asc = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);
  const desc = (v: number | null) => (v === null ? Number.NEGATIVE_INFINITY : v);
  if (key === "sales") return arr.sort((a, b) => desc(b.sales) - desc(a.sales));
  if (key === "commission")
    return arr.sort((a, b) => desc(b.commissionPercent) - desc(a.commissionPercent));
  return arr.sort((a, b) => asc(a.price) - asc(b.price));
};

export function ShopeeTrending() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sales");
  const [imported, setImported] = useState<Record<string, boolean>>({});
  const search = useServerFn(searchShopeeOffers);
  const importOffer = useServerFn(importShopeeOffer);
  const qc = useQueryClient();

  const sortType = TABS.find((t) => t.key === tab)!.sortType;

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["shopee-trending", tab],
    queryFn: () => search({ data: { page: 1, limit: 20, sortType } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const offers: Offer[] = sortOffers(((data as any)?.offers ?? []) as Offer[], tab);

  const importMutation = useMutation({
    mutationFn: (o: Offer) =>
      importOffer({
        data: {
          itemId: o.itemId,
          name: o.productName,
          imageUrl: o.imageUrl,
          price: o.price,
          discountPercent: o.discountPercent,
          commissionPercent: o.commissionPercent,
          salesCount: o.sales,
          rating: o.rating,
          shopName: o.shopName,
          productLink: o.productLink,
          offerLink: o.offerLink,
        },
      }),
    onSuccess: (_d, o) => {
      setImported((m) => ({ ...m, [o.itemId]: true }));
      toast.success("Produto salvo com o link de afiliada!");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar produto"),
  });

  return (
    <section className="rounded-2xl border border-border bg-surface/50 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">
              Produtos em alta na Shopee
            </h2>
            <p className="text-xs text-muted-foreground">
              Direto da API de Afiliados — salve com o link já pronto.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
              className={cn(tab === t.key && "bg-gradient-primary shadow-glow")}
            >
              {t.label}
            </Button>
          ))}
          <Button
            size="icon"
            variant="outline"
            onClick={() => refetch()}
            title="Atualizar"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Não deu para carregar as ofertas agora: {(error as any)?.message ?? "tente novamente"}.
        </p>
      ) : isLoading ? (
        <div className="mt-4 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-64 w-44 shrink-0 animate-pulse rounded-2xl border border-border bg-surface-elevated/60"
            />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma oferta disponível no momento.</p>
      ) : (
        <div className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {offers.map((o) => (
            <article
              key={o.itemId}
              className="flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/60 transition-colors hover:border-primary/50"
            >
              <div className="relative aspect-square bg-muted">
                {o.imageUrl ? (
                  <img
                    src={o.imageUrl}
                    alt={o.productName}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {o.discountPercent ? (
                  <Badge className="absolute left-2 top-2 bg-gradient-primary text-primary-foreground">
                    -{Math.round(o.discountPercent)}%
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-xs font-medium leading-snug">{o.productName}</p>
                <span className="font-display text-base font-bold text-primary">
                  {brl(o.price)}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  {o.commissionPercent !== null && <span>{o.commissionPercent}% comissão</span>}
                  {o.rating ? (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-current text-warning" />
                      {o.rating}
                    </span>
                  ) : null}
                  {o.sales ? <span>{o.sales} vendidos</span> : null}
                </div>
                <Button
                  size="sm"
                  variant={imported[o.itemId] ? "outline" : "default"}
                  disabled={imported[o.itemId] || importMutation.isPending}
                  onClick={() => importMutation.mutate(o)}
                  className={cn("mt-auto w-full", !imported[o.itemId] && "bg-gradient-primary shadow-glow")}
                >
                  {imported[o.itemId] ? (
                    <>
                      <Check className="mr-1 h-4 w-4" /> Salvo
                    </>
                  ) : importMutation.isPending && importMutation.variables?.itemId === o.itemId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" /> Salvar
                    </>
                  )}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
