/**
 * Gera automaticamente uma chamada para ação (CTA) por produto,
 * variando conforme desconto, preço, avaliação e nome — sem repetir
 * a mesma frase para produtos vizinhos.
 */

type CtaProduct = {
  id: string;
  name: string;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  rating?: number | null;
  sales_count?: number | null;
  category?: string | null;
};

const DISCOUNT = [
  "Corre que tá {d}% OFF!",
  "{d}% de desconto agora",
  "Baixou {d}% — aproveita",
  "Só hoje: {d}% OFF",
];

const CHEAP = [
  "Achadinho por menos de {p}",
  "Custa menos que um lanche",
  "Por {p} vale demais",
  "Preço de achadinho: {p}",
];

const LOVED = [
  "Nota {r} — queridinho geral",
  "Avaliado {r}, amei esse",
  "{r} estrelas, não erra",
];

const HOT = [
  "Mais de {s} vendidos",
  "Bombando: {s}+ vendas",
  "Tá voando das prateleiras",
];

const GENERIC = [
  "Toque e garanta o seu",
  "Eu uso e recomendo",
  "Clica pra ver o preço",
  "Meu queridinho, dá uma olhada",
  "Vale muito a pena, confere",
  "Quero um pra mim",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(list: string[], seed: number) {
  return list[seed % list.length];
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function generateCta(p: CtaProduct): string {
  const seed = hash(p.id + p.name);
  const discount =
    p.discount_percent ??
    (p.price && p.original_price && p.original_price > p.price
      ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100)
      : null);

  if (discount && discount >= 15)
    return pick(DISCOUNT, seed).replace("{d}", String(discount));

  if (p.sales_count && p.sales_count >= 500)
    return pick(HOT, seed).replace(
      "{s}",
      p.sales_count >= 1000
        ? `${Math.floor(p.sales_count / 1000)} mil`
        : String(p.sales_count),
    );

  if (p.rating && Number(p.rating) >= 4.6)
    return pick(LOVED, seed).replace("{r}", Number(p.rating).toFixed(1));

  if (p.price != null && Number(p.price) > 0 && Number(p.price) <= 50)
    return pick(CHEAP, seed).replace("{p}", brl(Number(p.price)));

  return pick(GENERIC, seed);
}
