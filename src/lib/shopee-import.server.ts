import { searchOffers, shortLink, shopeeGraphql, type ShopeeOffer } from "./shopee.server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

const OFFER_FIELDS = `
  itemId
  productName
  imageUrl
  price
  priceMin
  priceMax
  sales
  priceDiscountRate
  commissionRate
  ratingStar
  shopName
  offerLink
  productLink
`;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Segue redirects (s.shopee.com.br, shope.ee) até a URL final do produto. */
export async function resolveShopeeUrl(url: string): Promise<{ finalUrl: string; html: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
  });
  const html = res.ok ? await res.text() : "";
  return { finalUrl: res.url || url, html };
}

/** Extrai o itemId (e shopId) de uma URL/HTML da Shopee. */
export function extractItemIds(text: string): { shopId: string; itemId: string }[] {
  const found = new Map<string, { shopId: string; itemId: string }>();

  // .../produto-i.SHOPID.ITEMID
  for (const m of text.matchAll(/i\.(\d{4,})\.(\d{4,})/g)) {
    found.set(m[2]!, { shopId: m[1]!, itemId: m[2]! });
  }
  // JSON embutido
  for (const m of text.matchAll(/"item_?id"\s*:\s*"?(\d{6,})"?/gi)) {
    if (!found.has(m[1]!)) found.set(m[1]!, { shopId: "", itemId: m[1]! });
  }
  for (const m of text.matchAll(/[?&]itemId=(\d{6,})/gi)) {
    if (!found.has(m[1]!)) found.set(m[1]!, { shopId: "", itemId: m[1]! });
  }
  return [...found.values()];
}

function mapNode(node: Record<string, unknown>): ShopeeOffer {
  const commission = num(node.commissionRate);
  return {
    itemId: String(node.itemId ?? ""),
    productName: String(node.productName ?? ""),
    imageUrl: (node.imageUrl as string) ?? null,
    price: num(node.price),
    priceMin: num(node.priceMin),
    priceMax: num(node.priceMax),
    sales: num(node.sales),
    discountPercent: num(node.priceDiscountRate),
    commissionPercent:
      commission === null
        ? null
        : commission <= 1
          ? Number((commission * 100).toFixed(2))
          : commission,
    rating: num(node.ratingStar),
    shopName: (node.shopName as string) ?? null,
    offerLink: (node.offerLink as string) ?? null,
    productLink: (node.productLink as string) ?? null,
  };
}

/** Busca os dados oficiais de um produto pelo itemId. */
export async function offerByItemId(itemId: string): Promise<ShopeeOffer | null> {
  const query = `{ productOfferV2(itemId: ${JSON.stringify(itemId)}, page: 1, limit: 1) { nodes { ${OFFER_FIELDS} } } }`;
  try {
    const data = await shopeeGraphql<{
      productOfferV2?: { nodes?: Record<string, unknown>[] };
    }>(query);
    const node = data.productOfferV2?.nodes?.[0];
    return node ? mapNode(node) : null;
  } catch {
    return null;
  }
}

/** Fallback: metadados abertos da página (og:*). */
export function metaFromHtml(html: string) {
  const pick = (prop: string) => {
    const a = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ).exec(html)?.[1];
    const b = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i",
    ).exec(html)?.[1];
    const raw = a ?? b ?? null;
    return raw
      ? raw
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      : null;
  };
  const rawTitle = pick("og:title") ?? /<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
  const priceRaw = pick("product:price:amount");
  let price = priceRaw ? Number(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price <= 0)) price = null;
  if (price !== null && price > 100000) price = price / 100000;
  return {
    name: rawTitle
      ? rawTitle
          .replace(/\s*\|\s*Shopee.*$/i, "")
          .replace(/^Compre\s+/i, "")
          .slice(0, 200)
      : null,
    imageUrl: pick("og:image") ?? pick("twitter:image"),
    price: price === null ? null : Number(price.toFixed(2)),
    shopName: pick("og:site_name"),
  };
}

/** Dados completos de um link único da Shopee. */
export async function lookupShopeeLink(url: string) {
  const { finalUrl, html } = await resolveShopeeUrl(url);
  const ids = extractItemIds(`${finalUrl}\n${html.slice(0, 400_000)}`);
  const first = ids[0];

  let offer: ShopeeOffer | null = null;
  if (first) offer = await offerByItemId(first.itemId);

  const fallback = html ? metaFromHtml(html) : { name: null, imageUrl: null, price: null, shopName: null };

  let affiliateUrl = offer?.offerLink ?? null;
  if (!affiliateUrl) {
    try {
      affiliateUrl = await shortLink(finalUrl, []);
    } catch {
      affiliateUrl = null;
    }
  }

  const name = offer?.productName || fallback.name;
  if (!name && !fallback.imageUrl) {
    throw new Error(
      "Não consegui ler esse link. Use o link completo do produto (shopee.com.br/...) ou o link de afiliada.",
    );
  }

  return {
    itemId: offer?.itemId ?? first?.itemId ?? null,
    name: name ?? "",
    imageUrl: offer?.imageUrl ?? fallback.imageUrl ?? null,
    price: offer?.price ?? fallback.price ?? null,
    originalPrice: offer?.priceMax ?? null,
    discountPercent: offer?.discountPercent ?? null,
    commissionPercent: offer?.commissionPercent ?? null,
    salesCount: offer?.sales ?? null,
    rating: offer?.rating ?? null,
    shopName: offer?.shopName ?? fallback.shopName ?? null,
    productLink: offer?.productLink ?? finalUrl,
    affiliateUrl,
  };
}

/** Todos os produtos de um link de coleção/vitrine da Shopee. */
export async function lookupShopeeCollection(url: string) {
  const { finalUrl, html } = await resolveShopeeUrl(url);
  const ids = extractItemIds(`${finalUrl}\n${html}`).slice(0, 60);

  const results: Awaited<ReturnType<typeof lookupShopeeLink>>[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const offers = await Promise.all(batch.map((b) => offerByItemId(b.itemId)));
    for (let j = 0; j < offers.length; j++) {
      const offer = offers[j];
      const id = batch[j]!;
      if (!offer || !offer.productName) continue;
      let affiliateUrl = offer.offerLink ?? null;
      if (!affiliateUrl && offer.productLink) {
        try {
          affiliateUrl = await shortLink(offer.productLink, []);
        } catch {
          affiliateUrl = null;
        }
      }
      results.push({
        itemId: offer.itemId || id.itemId,
        name: offer.productName,
        imageUrl: offer.imageUrl,
        price: offer.price,
        originalPrice: offer.priceMax,
        discountPercent: offer.discountPercent,
        commissionPercent: offer.commissionPercent,
        salesCount: offer.sales,
        rating: offer.rating,
        shopName: offer.shopName,
        productLink: offer.productLink ?? finalUrl,
        affiliateUrl,
      });
    }
  }

  return results;
}

export { searchOffers };
