import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Upload } from "lucide-react";
import { upsertProduct } from "@/lib/products.functions";
import { importFromShopeeLink } from "@/lib/import-product.functions";
import { uploadProductPhoto } from "@/lib/images.functions";
import { WebImageSearch } from "@/components/web-image-search";




type Product = {
  id?: string;
  name?: string;
  url?: string | null;
  affiliate_url?: string | null;
  image_url?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  commission_percent?: number | null;
  sales_count?: number | null;
  rating?: number | null;
  shop_name?: string | null;
  category?: string | null;
  notes?: string | null;
  is_favorite?: boolean;
};

const empty: Product = {
  name: "",
  url: "",
  affiliate_url: "",
  image_url: "",
  price: null,
  original_price: null,
  discount_percent: null,
  commission_percent: null,
  sales_count: null,
  rating: null,
  shop_name: "",
  category: "",
  notes: "",
  is_favorite: false,
};

function toNum(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Product>(empty);
  const save = useServerFn(upsertProduct);
  const importLink = useServerFn(importFromShopeeLink);

  const importMutation = useMutation({
    mutationFn: (url: string) => importLink({ data: { url } }),
    onSuccess: (r: any) => {
      setForm((f) => ({
        ...f,
        image_url: r.imageUrl ?? f.image_url,
        name: f.name?.trim() ? f.name : (r.name ?? ""),
        price: f.price ?? r.price ?? null,
        shop_name: f.shop_name?.trim() ? f.shop_name : (r.shopName ?? ""),
      }));
      toast.success("Foto importada do link da Shopee");
    },
    onError: (e: any) => toast.error(e.message ?? "Não consegui importar do link"),
  });

  const runImport = () => {
    const url = (form.url || form.affiliate_url || "").trim();
    if (!url) {
      toast.error("Cole primeiro o link da Shopee");
      return;
    }
    importMutation.mutate(url);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useServerFn(uploadProductPhoto);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não consegui ler o arquivo"));
        reader.readAsDataURL(file);
      });
      return uploadPhoto({
        data: { base64, contentType: file.type || "image/jpeg" },
      });
    },
    onSuccess: (r: any) => {
      setForm((f) => ({ ...f, image_url: r.url }));
      toast.success("Foto enviada");
    },
    onError: (e: any) => toast.error(e.message ?? "Não consegui enviar a foto"),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 8MB)");
      return;
    }
    uploadMutation.mutate(file);
  };




  useEffect(() => {
    if (open) setForm(product ? { ...empty, ...product } : empty);
  }, [open, product]);

  const mutation = useMutation({
    mutationFn: (input: any) => save({ data: input }),
    onSuccess: () => {
      toast.success(product?.id ? "Produto atualizado" : "Produto adicionado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    mutation.mutate({
      id: form.id,
      name: form.name.trim(),
      url: form.url ?? "",
      affiliate_url: form.affiliate_url ?? "",
      image_url: form.image_url ?? "",
      price: form.price,
      original_price: form.original_price,
      discount_percent: form.discount_percent,
      commission_percent: form.commission_percent,
      sales_count: form.sales_count,
      rating: form.rating,
      shop_name: form.shop_name ?? "",
      category: form.category ?? "",
      notes: form.notes ?? "",
      is_favorite: form.is_favorite ?? false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product?.id ? "Editar produto" : "Adicionar produto"}</DialogTitle>
          <DialogDescription>
            Cole os dados do produto da Shopee. Só o nome é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do produto *</Label>
            <Input
              id="name"
              required
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Fone Bluetooth i12 TWS"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="url">Link Shopee</Label>
              <Input
                id="url"
                type="url"
                value={form.url ?? ""}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://shopee.com.br/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="affiliate_url">Link de afiliado</Label>
              <Input
                id="affiliate_url"
                type="url"
                value={form.affiliate_url ?? ""}
                onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })}
                placeholder="https://s.shopee.com.br/..."
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Buscar foto na web (grátis)</p>
              <p className="text-xs text-muted-foreground">
                Escreva o nome do produto e escolha uma foto — sem precisar enviar arquivo.
              </p>
            </div>
            <WebImageSearch
              defaultQuery={form.name ?? ""}
              onPicked={(url) => setForm((f) => ({ ...f, image_url: url }))}
            />

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium">Enviar foto do celular/PC</p>

                <p className="text-xs text-muted-foreground">
                  Jeito mais confiável: salve a foto no app da Shopee e envie aqui (grátis, sem IA).
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Enviar foto
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium">Importar foto do link</p>
                <p className="text-xs text-muted-foreground">
                  Tenta baixar a foto oficial pelo link — pode falhar se a Shopee bloquear.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={runImport}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Tentar pelo link
              </Button>
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="image_url">URL da imagem</Label>
            <div className="flex gap-3">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt="Pré-visualização do produto"
                  className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : null}
              <Input
                id="image_url"
                type="url"
                value={form.image_url ?? ""}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={form.price ?? ""}
                onChange={(e) => setForm({ ...form, price: toNum(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="original_price">De (R$)</Label>
              <Input
                id="original_price"
                inputMode="decimal"
                value={form.original_price ?? ""}
                onChange={(e) =>
                  setForm({ ...form, original_price: toNum(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_percent">Desconto (%)</Label>
              <Input
                id="discount_percent"
                inputMode="numeric"
                value={form.discount_percent ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_percent: toNum(e.target.value) as number | null,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="commission_percent">Comissão (%)</Label>
              <Input
                id="commission_percent"
                inputMode="decimal"
                value={form.commission_percent ?? ""}
                onChange={(e) =>
                  setForm({ ...form, commission_percent: toNum(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales_count">Vendas</Label>
              <Input
                id="sales_count"
                inputMode="numeric"
                value={form.sales_count ?? ""}
                onChange={(e) =>
                  setForm({ ...form, sales_count: toNum(e.target.value) as number | null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Avaliação (0–5)</Label>
              <Input
                id="rating"
                inputMode="decimal"
                value={form.rating ?? ""}
                onChange={(e) => setForm({ ...form, rating: toNum(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shop_name">Loja</Label>
              <Input
                id="shop_name"
                value={form.shop_name ?? ""}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={form.category ?? ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Eletrônicos"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Detalhes que você quer que a IA use no roteiro..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Favorito</p>
              <p className="text-xs text-muted-foreground">Aparece com destaque na lista.</p>
            </div>
            <Switch
              checked={form.is_favorite ?? false}
              onCheckedChange={(v) => setForm({ ...form, is_favorite: v })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product?.id ? "Salvar alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
