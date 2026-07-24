import { createFileRoute } from "@tanstack/react-router";
import { Library } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Biblioteca — ShopeeFlow" }] }),
  component: () => (
    <PlaceholderPage
      icon={Library}
      title="Biblioteca"
      description="Todos os seus vídeos, roteiros, legendas e produtos organizados em um só lugar. Disponível a partir da Fase 2."
      phase="Fase 2"
    />
  ),
});
