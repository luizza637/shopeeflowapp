import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check } from "lucide-react";
import { searchWebImages, saveImageFromUrl, type WebImage } from "@/lib/image-search.functions";

export function WebImageSearch({
  defaultQuery = "",
  onPicked,
}: {
  defaultQuery?: string;
  onPicked: (url: string) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<WebImage[]>([]);
  const [picking, setPicking] = useState<string | null>(null);

  const search = useServerFn(searchWebImages);
  const saveUrl = useServerFn(saveImageFromUrl);

  const searchMutation = useMutation({
    mutationFn: (q: string) => search({ data: { query: q } }),
    onSuccess: (r: any) => {
      setResults(r.results ?? []);
      if (!r.results?.length) toast.error("Nada encontrado, tente outras palavras.");
    },
    onError: (e: any) => toast.error(e.message ?? "Busca falhou, tente de novo"),
  });

  const pickMutation = useMutation({
    mutationFn: (url: string) => saveUrl({ data: { url } }),
    onSuccess: (r: any) => {
      onPicked(r.url);
      toast.success("Foto adicionada ao produto");
    },
    onError: (e: any) => toast.error(e.message ?? "Não consegui usar essa imagem"),
    onSettled: () => setPicking(null),
  });

  const runSearch = () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Escreva o que quer buscar");
      return;
    }
    searchMutation.mutate(q);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Ex: fone bluetooth i12 tws branco"
        />
        <Button type="button" onClick={runSearch} disabled={searchMutation.isPending}>
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {results.length > 0 ? (
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {results.map((img) => {
            const busy = picking === img.url && pickMutation.isPending;
            return (
              <button
                key={img.url}
                type="button"
                onClick={() => {
                  setPicking(img.url);
                  pickMutation.mutate(img.url);
                }}
                disabled={pickMutation.isPending}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary hover:shadow-lg disabled:opacity-60"
                title={img.title || "Usar esta foto"}
              >
                <img
                  src={img.thumb}
                  alt={img.title || "Resultado da busca"}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition group-hover:opacity-100">
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </span>
                {busy ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Busque pelo nome do produto e clique na foto que quiser — ela é salva automaticamente.
        </p>
      )}
    </div>
  );
}
