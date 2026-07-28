import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, ShoppingBag, Star, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchShopeeOffers, importShopeeOffer } from "@/lib/shopee.functions";

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

export function ShopeeSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [imported, setImported] = useState<Record<string, boolean>>({});
  const search = useServerFn(searchShopeeOffers);
  const importOffer = useServerFn(importShopeeOffer);
  const qc = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: () => search({ data: { keyword: keyword.trim(), page: 1, limit: 20 } }),
    onSuccess: (r: any) => {
      setOffers(r.offers ?? []);
      if (!r.offers?.length) toast.info("Nenhuma oferta encontrada para esse termo.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro na busca"),
  });

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Buscar na Shopee
          </DialogTitle>
          <DialogDescription>
            Busca oficial pela API de Afiliados. O link de afiliada já vem pronto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 px-6 pt-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyword.trim()) searchMutation.mutate();
              }}
              placeholder="Ex.: fone bluetooth, air fryer, hidratante..."
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => searchMutation.mutate()}
            disabled={!keyword.trim() || searchMutation.isPending}
            className="bg-gradient-primary shadow-glow hover:opacity-90"
          >
            {searchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Buscar"
            )}
          </Button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6">
          {offers.length === 0 && !searchMutation.isPending && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Digite o que você quer divulgar e clique em Buscar.
            </p>
          )}

          {offers.map((o) => (
            <div
              key={o.itemId}
              className="flex gap-3 rounded-2xl border border-border bg-surface/50 p-3"
            >
              {o.imageUrl ? (
                <img
                  src={o.imageUrl}
                  alt={o.productName}
                  loading="lazy"
                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-xl bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{o.productName}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.shopName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-primary">{brl(o.price)}</span>
                  {o.commissionPercent !== null && (
                    <Badge variant="secondary">{o.commissionPercent}% comissão</Badge>
                  )}
                  {o.rating ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-current text-amber-400" />
                      {o.rating}
                    </span>
                  ) : null}
                  {o.sales ? (
                    <span className="text-xs text-muted-foreground">{o.sales} vendidos</span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  size="sm"
                  variant={imported[o.itemId] ? "outline" : "default"}
                  disabled={imported[o.itemId] || importMutation.isPending}
                  onClick={() => importMutation.mutate(o)}
                  className={imported[o.itemId] ? "" : "bg-gradient-primary shadow-glow"}
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
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
