import { MousePointerClick, Users } from "lucide-react";

/**
 * Selos de prova social com métricas REAIS da vitrine.
 * Nada é simulado: visitas são visitantes únicos de hoje e cliques são
 * cliques reais registrados no servidor nos últimos 7 dias.
 */
export function LivePurchaseFeed({
  viewsToday = 0,
  clicksTotal = 0,
}: {
  viewsToday?: number;
  clicksTotal?: number;
}) {
  if (!viewsToday && !clicksTotal) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {viewsToday > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {viewsToday === 1 ? "1 visita hoje" : `${viewsToday} visitas hoje`}
        </span>
      )}
      {clicksTotal > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <MousePointerClick className="h-3.5 w-3.5" />
          {clicksTotal === 1
            ? "1 clique nos produtos (7 dias)"
            : `${clicksTotal} cliques nos produtos (7 dias)`}
        </span>
      )}
    </div>
  );
}
