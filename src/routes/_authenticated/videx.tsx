import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Upload, RefreshCw, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VideoImportDialog } from "@/components/video-import-dialog";

const VIDEX_URL = "https://www.videx.space/";

export const Route = createFileRoute("/_authenticated/videx")({
  head: () => ({
    meta: [
      { title: "VidEx — criar e importar vídeos | ShopeeFlow" },
      {
        name: "description",
        content:
          "Abra o VidEx dentro do ShopeeFlow, baixe seu vídeo e importe para limpar metadados, ajustar em 9:16 e salvar na biblioteca.",
      },
      { property: "og:title", content: "VidEx — criar e importar vídeos | ShopeeFlow" },
      {
        property: "og:description",
        content:
          "Painel do VidEx integrado e importação automática de vídeos com remoção de metadados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VidexPage,
});

function VidexPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    setBlocked(false);
    const t = setTimeout(() => {
      if (!loadedRef.current) setBlocked(true);
    }, 20000);
    return () => clearTimeout(t);
  }, [reloadKey]);


  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            VidEx
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o vídeo no VidEx e traga para cá: removemos somente os metadados,
            salvamos a legenda e vinculamos o produto da Shopee pelo link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar
          </Button>
          <Button variant="outline" asChild>
            <a href={VIDEX_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir em nova aba
            </a>
          </Button>
          <Button
            onClick={() => setImportOpen(true)}
            className="bg-gradient-primary shadow-glow hover:opacity-90"
          >
            <Upload className="mr-2 h-4 w-4" />
            Apagar metadados
          </Button>

        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
        <span>
          A página do VidEx não abriu ou apareceu um erro do navegador? Abra em uma
          nova aba, baixe o vídeo e volte aqui para importar.
        </span>
        <Button size="sm" variant="outline" asChild className="ml-auto">
          <a href={VIDEX_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova aba
          </a>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/60">
        {blocked && (
          <div className="flex flex-col items-center justify-center gap-3 border-b border-border/60 bg-surface/60 px-6 py-6 text-center">
            <Clapperboard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              O VidEx está demorando para carregar aqui dentro. Você pode esperar,
              recarregar ou abrir em uma nova aba.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recarregar
              </Button>
              <Button size="sm" asChild>
                <a href={VIDEX_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir VidEx
                </a>
              </Button>
            </div>
          </div>
        )}
        <iframe
          key={reloadKey}
          src={VIDEX_URL}
          title="VidEx"
          onLoad={() => {
            loadedRef.current = true;
            setBlocked(false);
          }}
          className="h-[75vh] w-full bg-background"
          allow="clipboard-write; fullscreen; camera; microphone"
        />
      </Card>


      <VideoImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
