import { createHash } from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

/**
 * Chamada assinada à Shopee Affiliate Open API (GraphQL).
 * Assinatura: SHA256(AppId + Timestamp + Payload + Secret)
 */
export async function shopeeGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET;
  if (!appId || !secret) {
    throw new Error(
      "Credenciais da Shopee não configuradas. Cadastre o App ID e o App Secret nas configurações do app.",
    );
  }

  const payload = JSON.stringify(variables ? { query, variables } : { query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256")
    .update(`${appId}${timestamp}${payload}${secret}`)
    .digest("hex");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shopee (${res.status}): ${text.slice(0, 300)}`);
  }

  let json: { data?: T; errors?: Array<{ message?: string }> };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida da Shopee.");
  }
  if (json.errors?.length) {
    throw new Error(`Shopee: ${json.errors.map((e) => e.message).join("; ").slice(0, 300)}`);
  }
  if (!json.data) throw new Error("A Shopee não retornou dados.");
  return json.data;
}

export type ShopeeOffer = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number | null;
  discountPercent: number | null;
  commissionPercent: number | null;
  rating: number | null;
  shopName: string | null;
  offerLink: string | null;
  productLink: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type RawNode = Record<string, unknown>;

function mapOffer(node: RawNode): ShopeeOffer {
  const discountRate = num(node.priceDiscountRate);
  const commission = num(node.commissionRate);
  const rating = num(node.ratingStar);
  return {
    itemId: String(node.itemId ?? ""),
    productName: String(node.productName ?? ""),
    imageUrl: (node.imageUrl as string) ?? null,
    price: num(node.price),
    priceMin: num(node.priceMin),
    priceMax: num(node.priceMax),
    sales: num(node.sales),
    discountPercent: discountRate,
    // A API devolve a comissão como fração (0.12 = 12%).
    commissionPercent:
      commission === null ? null : commission <= 1 ? Number((commission * 100).toFixed(2)) : commission,
    rating: rating,
    shopName: (node.shopName as string) ?? null,
    offerLink: (node.offerLink as string) ?? null,
    productLink: (node.productLink as string) ?? null,
  };
}

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

export async function searchOffers(params: {
  keyword?: string;
  page: number;
  limit: number;
  sortType?: number;
}): Promise<{ offers: ShopeeOffer[]; hasNextPage: boolean }> {
  const args = [
    `page:${params.page}`,
    `limit:${params.limit}`,
    params.keyword ? `keyword:${JSON.stringify(params.keyword)}` : null,
    params.sortType ? `sortType:${params.sortType}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const query = `{ productOfferV2(${args}) { nodes { ${OFFER_FIELDS} } pageInfo { hasNextPage } } }`;

  const data = await shopeeGraphql<{
    productOfferV2?: { nodes?: RawNode[]; pageInfo?: { hasNextPage?: boolean } };
  }>(query);

  return {
    offers: (data.productOfferV2?.nodes ?? []).map(mapOffer),
    hasNextPage: Boolean(data.productOfferV2?.pageInfo?.hasNextPage),
  };
}

export async function shortLink(originUrl: string, subIds: string[] = []): Promise<string> {
  const query = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(
    originUrl,
  )}, subIds: ${JSON.stringify(subIds)} }) { shortLink } }`;
  const data = await shopeeGraphql<{ generateShortLink?: { shortLink?: string } }>(query);
  const link = data.generateShortLink?.shortLink;
  if (!link) throw new Error("A Shopee não retornou o link de afiliada.");
  return link;
}
