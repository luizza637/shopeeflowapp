import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Layers, Link2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { importShopeeCollection } from "@/lib/shopee-import.functions";

export function ShopeeCollectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const importCollection = useServerFn(importShopeeCollection);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => importCollection({ data: { url: url.trim() } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `${r.imported} produto(s) importados${r.skipped ? ` · ${r.skipped} já existiam` : ""}`,
      );
      setUrl("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não consegui importar a coleção"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Importar coleção da Shopee
          </DialogTitle>
          <DialogDescription>
            Cole o link da sua coleção/vitrine de afiliada. Todos os produtos entram aqui com
            foto, preço, comissão e link de afiliada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="collection-url">Link da coleção</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="collection-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://s.shopee.com.br/... ou shopee.com.br/collections/..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!url.trim() || mutation.isPending}
              className="bg-gradient-primary shadow-glow hover:opacity-90"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Layers className="mr-2 h-4 w-4" />
              )}
              Importar tudo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
