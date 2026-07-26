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
    }, 6000);
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
            Crie o vídeo no VidEx e traga para cá: removemos os metadados, ajustamos
            para 9:16 e salvamos na sua biblioteca com Kit de Post.
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
            Importar vídeo
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden border-border/60">
        {blocked ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
            <Clapperboard className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">O VidEx não permite ser exibido aqui dentro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O site bloqueia a exibição em janelas incorporadas. Abra em uma nova
                aba, baixe o vídeo e volte para importar.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <a href={VIDEX_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir VidEx
                </a>
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar vídeo baixado
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={VIDEX_URL}
            title="VidEx"
            onLoad={() => {
              loadedRef.current = true;
            }}
            className="h-[75vh] w-full bg-background"
            allow="clipboard-write; fullscreen"
            referrerPolicy="no-referrer"
          />
        )}
      </Card>

      <VideoImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
