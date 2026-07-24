import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Sparkles, Video, Calendar, Wand2, Zap, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShopeeFlow — Vídeos de afiliada Shopee no automático" },
      {
        name: "description",
        content:
          "Encontre produtos, gere vídeos com IA, agende e publique no TikTok e Instagram. Automação completa para afiliados da Shopee.",
      },
      { property: "og:title", content: "ShopeeFlow — Vídeos de afiliada Shopee no automático" },
      {
        property: "og:description",
        content: "Automação completa para afiliados da Shopee com IA de ponta a ponta.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-gradient-mesh">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">ShopeeFlow</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost">Entrar</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 text-center md:py-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-4 py-1.5 text-xs backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Assistente pessoal com IA</span>
        </div>

        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Vídeos de afiliada
          <br />
          <span className="text-gradient-primary">Shopee no piloto automático</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Encontre produtos em alta, crie vídeos com IA, gere legendas sincronizadas, agende
          publicações e poste direto no TikTok e Instagram. Tudo em um só lugar.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/auth">
            <Button
              size="lg"
              className="h-12 bg-gradient-primary px-8 text-base font-semibold shadow-glow hover:opacity-90"
            >
              Começar grátis
            </Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              Ver recursos
            </Button>
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Wand2,
              title: "IA cria tudo por você",
              body: "Roteiro, gancho, CTA, legenda, hashtags e narração. Você seleciona o produto, a IA faz o resto.",
            },
            {
              icon: Video,
              title: "Vídeos verticais prontos",
              body: "Zoom automático, transições suaves, música, legendas sincronizadas. Otimizado para Reels e TikTok.",
            },
            {
              icon: Calendar,
              title: "Agendamento inteligente",
              body: "Até 5 publicações por dia em horários personalizados. Sem repetir produto.",
            },
            {
              icon: ShoppingBag,
              title: "Produtos em alta",
              body: "Busque por comissão, vendas, categoria ou palavra-chave. A IA sugere os melhores para gravar.",
            },
            {
              icon: Zap,
              title: "Publicação em 1 clique",
              body: "TikTok, Instagram Reels e Shopee Video. Metadados removidos automaticamente.",
            },
            {
              icon: Sparkles,
              title: "Biblioteca completa",
              body: "Todos os vídeos, roteiros, produtos e histórico organizados num painel profissional.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-surface/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-glow"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
