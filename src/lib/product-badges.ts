/**
 * Selos dinâmicos por produto ("Mais comprado", "Últimas unidades", etc.)
 * Determinísticos por id, para não mudar a cada render.
 */

export type BadgeTone = "hot" | "gold" | "info" | "urgent";

export type ProductBadge = {
  label: string;
  emoji: string;
  tone: BadgeTone;
};

type BadgeProduct = {
  id: string;
  name: string;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  rating?: number | null;
  sales_count?: number | null;
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const FILLERS: ProductBadge[] = [
  { label: "Últimas unidades", emoji: "⏳", tone: "urgent" },
  { label: "Achadinho do dia", emoji: "💛", tone: "info" },
  { label: "Voando do estoque", emoji: "🚀", tone: "hot" },
  { label: "Queridinho", emoji: "😍", tone: "gold" },
  { label: "Bombando agora", emoji: "🔥", tone: "hot" },
  { label: "Vale cada centavo", emoji: "✨", tone: "info" },
];

export function getProductBadges(p: BadgeProduct): ProductBadge[] {
  if (!p) return [];
  const seed = hash(String(p.id ?? "") + String(p.name ?? ""));
  const badges: ProductBadge[] = [];

  const discount =
    p.discount_percent ??
    (p.price && p.original_price && p.original_price > p.price
      ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100)
      : 0);

  if (discount >= 30) badges.push({ label: `${discount}% OFF`, emoji: "🔥", tone: "hot" });
  if ((p.sales_count ?? 0) >= 500)
    badges.push({ label: "Mais comprado", emoji: "🏆", tone: "gold" });
  if (p.rating != null && Number(p.rating) >= 4.7)
    badges.push({ label: `Top ${Number(p.rating).toFixed(1)}`, emoji: "⭐", tone: "gold" });
  if (p.price != null && Number(p.price) > 0 && Number(p.price) <= 30)
    badges.push({ label: "Menos de R$30", emoji: "💸", tone: "info" });

  const pick = (i: number) => FILLERS[((i % FILLERS.length) + FILLERS.length) % FILLERS.length];

  if (badges.length === 0) badges.push(pick(seed));
  if (badges.length < 2 && seed % 3 !== 0) {
    for (let k = 0; k < FILLERS.length; k++) {
      const cand = pick((seed >> 3) + k);
      if (cand && !badges.some((b) => b?.label === cand.label)) {
        badges.push(cand);
        break;
      }
    }
  }

  const seen = new Set<string>();
  return badges
    .filter((b): b is ProductBadge => !!b && !seen.has(b.label) && seen.add(b.label) !== undefined)
    .slice(0, 2);
}


export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  hot: "bg-primary/15 text-primary border-primary/40",
  gold: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  info: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  urgent: "bg-rose-500/15 text-rose-400 border-rose-500/40",
};
