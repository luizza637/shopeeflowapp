import { createFileRoute } from "@tanstack/react-router";
import { Video } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({ meta: [{ title: "Vídeos — ShopeeFlow" }] }),
  component: () => (
    <PlaceholderPage
      icon={Video}
      title="Vídeos"
      description="Editor de vídeo com zoom automático, transições, música, legendas sincronizadas e narração por IA. Chega na Fase 4."
      phase="Fase 4"
    />
  ),
});
