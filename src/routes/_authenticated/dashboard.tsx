import { createFileRoute } from "@tanstack/react-router";
import {
  ShoppingBag,
  Heart,
  TrendingUp,
  Video,
  Send,
  CalendarClock,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ShopeeFlow" },
      { name: "description", content: "Painel de controle do seu fluxo de vídeos Shopee." },
    ],
  }),
  component: DashboardPage,
});

const stats = [
  { label: "Produtos hoje", value: 0, icon: ShoppingBag, tone: "primary" as const, trend: "+0" },
  { label: "Favoritos", value: 0, icon: Heart, tone: "primary" as const, trend: "+0" },
  { label: "Em alta", value: 0, icon: TrendingUp, tone: "success" as const, trend: "+0" },
  { label: "Vídeos gerados", value: 0, icon: Video, tone: "primary" as const, trend: "+0" },
  { label: "Publicados", value: 0, icon: Send, tone: "success" as const, trend: "+0" },
  { label: "Agendados", value: 0, icon: CalendarClock, tone: "warning" as const, trend: "0" },
];

const chartData = [
  { day: "Seg", videos: 0 },
  { day: "Ter", videos: 0 },
  { day: "Qua", videos: 0 },
  { day: "Qui", videos: 0 },
  { day: "Sex", videos: 0 },
  { day: "Sáb", videos: 0 },
  { day: "Dom", videos: 0 },
];

function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Fase 1 — Base do sistema</span>
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Bem-vinda ao <span className="text-gradient-primary">ShopeeFlow</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Seu painel central de produção de vídeos de afiliada.
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:shadow-card"
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className={
                  s.tone === "success"
                    ? "flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success"
                    : s.tone === "warning"
                      ? "flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning"
                      : "flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                }
              >
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{s.trend}</span>
            </div>
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-2xl border border-border bg-surface p-6 lg:col-span-2">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Produção dos últimos 7 dias</h2>
              <p className="text-sm text-muted-foreground">Vídeos gerados por dia</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.2 34)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.68 0.2 34)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.014 40)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="oklch(0.65 0.015 40)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.65 0.015 40)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.19 0.014 40)",
                    border: "1px solid oklch(0.26 0.014 40)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="videos"
                  stroke="oklch(0.68 0.2 34)"
                  strokeWidth={2}
                  fill="url(#grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next steps */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Próximos passos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue a construção do seu sistema
          </p>

          <div className="mt-4 space-y-3">
            {[
              { title: "Fase 2 — Produtos + IA de texto", ready: false },
              { title: "Fase 3 — Geração de imagens", ready: false },
              { title: "Fase 4 — Editor de vídeo", ready: false },
              { title: "Fase 5 — Publicação automática", ready: false },
              { title: "Fase 6 — Automação total", ready: false },
            ].map((p) => (
              <div
                key={p.title}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2.5"
              >
                <span className="text-sm">{p.title}</span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Atividade recente</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim que você começar a gerar vídeos, seu histórico aparece aqui.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Tudo pronto para começar</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Na próxima fase eu ativo a busca de produtos e a IA que cria roteiro, legenda,
            hashtags e narração.
          </p>
        </div>
      </div>
    </div>
  );
}
