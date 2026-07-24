import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Heart,
  Plus,
  Search,
  Sparkles,
  Star,
  ShoppingBag,
  Trash2,
  ExternalLink,
  Pencil,
  Loader2,
  Wand2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  listProducts,
  toggleFavorite,
  deleteProduct,
} from "@/lib/products.functions";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { AiContentDialog } from "@/components/ai-content-dialog";
import { ImageStudioDialog } from "@/components/image-studio-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Produtos — ShopeeFlow" },
      {
        name: "description",
        content:
          "Salve produtos Shopee, favorite os melhores e gere roteiro, legenda e hashtags com IA.",
      },
    ],
  }),
  component: ProductsPage,
});

type SortKey = "recent" | "commission" | "sales" | "rating" | "discount";

function ProductsPage() {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [aiProduct, setAiProduct] = useState<any | null>(null);

  const list = useServerFn(listProducts);
  const toggle = useServerFn(toggleFavorite);
  const remove = useServerFn(deleteProduct);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", { search, favoritesOnly, sort }],
    queryFn: () => list({ data: { search, favoritesOnly, sort } }),
  });

  const favMutation = useMutation({
    mutationFn: (v: { id: string; value: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Produto removido");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Produtos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Salve produtos da Shopee, favorite os melhores e gere conteúdo com IA num clique.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="bg-gradient-primary shadow-glow hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar produto
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-3 backdrop-blur-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((v) => !v)}
            className={cn(favoritesOnly && "bg-gradient-primary shadow-glow")}
          >
            <Heart
              className={cn("mr-2 h-4 w-4", favoritesOnly && "fill-current")}
            />
            Favoritos
          </Button>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="commission">Maior comissão</SelectItem>
              <SelectItem value="sales">Mais vendidos</SelectItem>
              <SelectItem value="rating">Melhor avaliação</SelectItem>
              <SelectItem value="discount">Maior desconto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl border border-border bg-surface/40"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          onAdd={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          filtered={Boolean(search || favoritesOnly)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              product={p}
              onToggleFavorite={() =>
                favMutation.mutate({ id: p.id, value: !p.is_favorite })
              }
              onEdit={() => {
                setEditing(p);
                setFormOpen(true);
              }}
              onDelete={() => {
                if (confirm(`Remover "${p.name}"?`)) delMutation.mutate(p.id);
              }}
              onGenerate={() => setAiProduct(p)}
            />
          ))}
        </div>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })}
      />
      <AiContentDialog
        product={aiProduct}
        onClose={() => setAiProduct(null)}
      />
    </div>
  );
}

function EmptyState({ onAdd, filtered }: { onAdd: () => void; filtered: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShoppingBag className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-semibold">
        {filtered ? "Nenhum produto encontrado" : "Comece adicionando seu primeiro produto"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Ajuste a busca ou desative o filtro de favoritos."
          : "Cole o link do produto na Shopee, adicione o valor da comissão e a IA cuida do resto."}
      </p>
      {!filtered && (
        <Button
          onClick={onAdd}
          className="mt-6 bg-gradient-primary shadow-glow hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar produto
        </Button>
      )}
    </div>
  );
}

function ProductCard({
  product,
  onToggleFavorite,
  onEdit,
  onDelete,
  onGenerate,
}: {
  product: any;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
}) {
  const price = product.price != null ? `R$ ${Number(product.price).toFixed(2)}` : null;
  const original =
    product.original_price != null
      ? `R$ ${Number(product.original_price).toFixed(2)}`
      : null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/60 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-elevated">
      <div className="relative aspect-video overflow-hidden bg-surface-elevated">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-40" />
          </div>
        )}
        <button
          onClick={onToggleFavorite}
          className={cn(
            "absolute right-2 top-2 rounded-full bg-background/70 p-2 backdrop-blur-md transition-colors",
            product.is_favorite
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Favoritar"
          title="Favoritar"
        >
          <Heart className={cn("h-4 w-4", product.is_favorite && "fill-current")} />
        </button>
        {product.discount_percent ? (
          <Badge className="absolute left-2 top-2 bg-gradient-primary text-primary-foreground">
            -{product.discount_percent}%
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-medium leading-snug">{product.name}</h3>
        {product.shop_name ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {product.shop_name}
          </p>
        ) : null}

        <div className="mt-3 flex items-baseline gap-2">
          {price && <span className="font-display text-lg font-bold">{price}</span>}
          {original && original !== price && (
            <span className="text-xs text-muted-foreground line-through">{original}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {product.commission_percent != null && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {product.commission_percent}% comissão
            </Badge>
          )}
          {product.rating != null && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3 fill-current text-warning" />
              {Number(product.rating).toFixed(1)}
            </Badge>
          )}
          {product.sales_count != null && (
            <Badge variant="secondary">{product.sales_count} vendas</Badge>
          )}
          {product.category && <Badge variant="outline">{product.category}</Badge>}
        </div>

        <div className="mt-4 flex flex-1 items-end gap-2">
          <Button
            size="sm"
            onClick={onGenerate}
            className="flex-1 bg-gradient-primary shadow-glow hover:opacity-90"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Gerar com IA
          </Button>
          {product.url && (
            <Button asChild size="icon" variant="outline" title="Abrir na Shopee">
              <a href={product.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button size="icon" variant="outline" onClick={onEdit} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onDelete}
            title="Remover"
            className="hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Re-export loader spinner (avoid unused import warning)
export { Loader2 };
