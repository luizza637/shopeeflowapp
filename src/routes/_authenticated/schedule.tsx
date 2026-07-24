import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Agendamento — ShopeeFlow" }] }),
  component: () => (
    <PlaceholderPage
      icon={CalendarClock}
      title="Agendamento"
      description="Programe até 5 publicações por dia em horários personalizados. TikTok, Instagram Reels e Shopee Video. Chega na Fase 5."
      phase="Fase 5"
    />
  ),
});
