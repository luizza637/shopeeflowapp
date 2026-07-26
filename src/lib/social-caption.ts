export type SocialPlatform = "shopee" | "tiktok" | "instagram";

export const SOCIAL_PLATFORMS: {
  id: SocialPlatform;
  label: string;
  emoji: string;
  /** Onde o vídeo é postado */
  uploadUrl: string;
}[] = [
  {
    id: "shopee",
    label: "Shopee Vídeo",
    emoji: "🛍️",
    uploadUrl: "https://creator.shopee.com.br/",
  },
  {
    id: "tiktok",
    label: "TikTok",
    emoji: "🎵",
    uploadUrl: "https://www.tiktok.com/tiktokstudio/upload",
  },
  {
    id: "instagram",
    label: "Instagram Reels",
    emoji: "📸",
    uploadUrl: "https://www.instagram.com/",
  },
];

export function platformInfo(p: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((x) => x.id === p) ?? SOCIAL_PLATFORMS[0];
}

const CTA: Record<SocialPlatform, string> = {
  shopee: "🛒 Toque no produto marcado e garanta o seu!",
  tiktok: "👉 Link do achadinho na bio!",
  instagram: "🔗 Link na bio para comprar com desconto",
};

const TAGS: Record<SocialPlatform, string> = {
  shopee: "#shopee #achadinhos #ofertas #promocao #achadinhosshopee",
  tiktok:
    "#achadinhosshopee #tiktokmefezcomprar #achadinhos #shopeefinds #promocao #fyp",
  instagram:
    "#achadinhos #achadinhosshopee #reels #dicasdecompra #promocao #ofertadodia",
};

const MAX: Record<SocialPlatform, number> = {
  shopee: 2000,
  tiktok: 2100,
  instagram: 2100,
};

function uniqueTags(a: string, b: string) {
  const all = `${a} ${b}`.split(/\s+/).filter((t) => t.startsWith("#"));
  return Array.from(new Set(all.map((t) => t.toLowerCase()))).slice(0, 12).join(" ");
}

/**
 * Monta a legenda no formato ideal de cada plataforma.
 * Na Shopee o link de afiliado não é permitido na legenda (o produto é marcado),
 * então ele é omitido.
 */
export function buildCaption(
  platform: SocialPlatform,
  input: { caption?: string | null; hashtags?: string | null; link?: string | null },
): string {
  const base = (input.caption ?? "").trim();
  const tags = uniqueTags(input.hashtags ?? "", TAGS[platform]);
  const link = (input.link ?? "").trim();

  const lines = [base, "", CTA[platform]];
  if (link && platform !== "shopee") lines.push(`🛒 ${link}`);
  lines.push("", tags);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX[platform]);
}
