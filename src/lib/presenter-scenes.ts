// Gera cenas com "apresentador IA": imagens fotorrealistas de uma pessoa
// segurando/usando o produto, para que o vídeo não seja apenas voz + foto.
// O perfil do apresentador pode ser escolhido (mulher/homem) ou variar
// automaticamente conforme a categoria/nome do produto.
//
// Consistência: um "character sheet" fixo (rosto, cabelo, roupa, cenário) é
// repetido em todos os prompts e a primeira cena é usada como referência
// visual nas cenas seguintes.

import { streamImage } from "@/lib/stream-image";

export type PresenterGender = "auto" | "female" | "male";

export type PresenterScene = {
  id: string;
  label: string;
  dataUrl: string;
};

type Persona = {
  gender: "female" | "male";
  who: string;
  outfit: string;
  place: string;
};

const PERSONAS: Record<string, Persona[]> = {
  beleza: [
    {
      gender: "female",
      who: "mulher brasileira de 24 anos, cabelo ondulado castanho na altura dos ombros, pele luminosa, maquiagem natural",
      outfit: "blusa de tricô bege lisa, brincos pequenos dourados",
      place: "banheiro claro e organizado com espelho e plantas",
    },
    {
      gender: "male",
      who: "homem brasileiro de 27 anos, cabelo curto escuro, barba aparada, pele saudável",
      outfit: "camiseta branca lisa de algodão",
      place: "banheiro claro e organizado com espelho e plantas",
    },
  ],
  moda: [
    {
      gender: "female",
      who: "mulher brasileira de 27 anos, cabelo liso castanho-escuro preso em rabo de cavalo, sorriso espontâneo",
      outfit: "camiseta branca básica e calça jeans clara",
      place: "quarto claro com espelho de corpo inteiro",
    },
    {
      gender: "male",
      who: "homem brasileiro de 29 anos, cabelo curto ondulado, barba curta",
      outfit: "camiseta preta lisa e calça jeans escura",
      place: "quarto claro com espelho de corpo inteiro",
    },
  ],
  eletronicos: [
    {
      gender: "male",
      who: "homem brasileiro de 29 anos, barba curta, cabelo escuro curto",
      outfit: "camiseta cinza lisa",
      place: "mesa de escritório em casa com luz suave",
    },
    {
      gender: "female",
      who: "mulher brasileira de 26 anos, óculos de armação fina, cabelo escuro liso",
      outfit: "camisa jeans clara aberta sobre camiseta branca",
      place: "bancada clara com notebook desfocado ao fundo",
    },
  ],
  casa: [
    {
      gender: "female",
      who: "mulher brasileira de 35 anos, cabelo castanho preso em coque baixo",
      outfit: "blusa de linho branca de manga curta",
      place: "cozinha clara e arrumada, luz natural",
    },
    {
      gender: "male",
      who: "homem brasileiro de 33 anos, cabelo curto escuro, sem barba",
      outfit: "camisa clara de manga dobrada",
      place: "sala de estar aconchegante com sofá bege",
    },
  ],
  fitness: [
    {
      gender: "female",
      who: "mulher brasileira de 25 anos, cabelo preso em rabo de cavalo alto, condicionamento atlético",
      outfit: "top esportivo preto e legging preta",
      place: "academia moderna com iluminação difusa",
    },
    {
      gender: "male",
      who: "homem brasileiro de 28 anos, atlético, cabelo curto",
      outfit: "regata cinza e shorts esportivo preto",
      place: "sala de treino em casa com tapete e halteres",
    },
  ],
  infantil: [
    {
      gender: "female",
      who: "mãe brasileira de 31 anos, cabelo castanho ondulado, sorriso caloroso",
      outfit: "blusa rosa claro lisa",
      place: "quarto infantil claro e alegre",
    },
    {
      gender: "male",
      who: "pai brasileiro de 33 anos, cabelo curto escuro, sorriso caloroso",
      outfit: "camiseta azul clara lisa",
      place: "quarto infantil claro e alegre",
    },
  ],
  geral: [
    {
      gender: "female",
      who: "mulher brasileira de 28 anos, cabelo castanho ondulado na altura dos ombros, aparência simpática e natural",
      outfit: "camiseta bege lisa",
      place: "ambiente doméstico claro com luz natural",
    },
    {
      gender: "male",
      who: "homem brasileiro de 30 anos, cabelo curto escuro, barba curta, aparência simpática e natural",
      outfit: "camiseta azul-marinho lisa",
      place: "ambiente doméstico claro com luz natural",
    },
  ],
};

const KEYWORDS: Array<[RegExp, keyof typeof PERSONAS]> = [
  [/(maquiagem|batom|skincare|creme|perfume|cabelo|shampoo|unha|beleza|sérum|serum)/i, "beleza"],
  [/(vestido|blusa|cal[çc]a|sapato|t[êe]nis|bolsa|roupa|moda|biqu[íi]ni|jaqueta|rel[óo]gio|[óo]culos)/i, "moda"],
  [/(fone|celular|smart|tv|note|teclado|mouse|carregador|c[âa]mera|caixa de som|eletr[ôo]nic|gamer|led)/i, "eletronicos"],
  [/(cozinha|panela|organiza|casa|cama|toalha|limpeza|utens[íi]lio|copo|garrafa|decora)/i, "casa"],
  [/(treino|academia|fitness|halter|whey|esporte|corrida|yoga)/i, "fitness"],
  [/(beb[êe]|infantil|crian[çc]a|brinquedo|fralda)/i, "infantil"],
];

function pickPersona(
  product: { name?: string | null; category?: string | null },
  gender: PresenterGender = "auto",
): Persona {
  const hay = `${product.category ?? ""} ${product.name ?? ""}`;
  let bucket: keyof typeof PERSONAS = "geral";
  for (const [re, key] of KEYWORDS) {
    if (re.test(hay)) {
      bucket = key;
      break;
    }
  }
  const list = PERSONAS[bucket] ?? PERSONAS.geral;
  const filtered =
    gender === "auto" ? list : list.filter((p) => p.gender === gender);
  const pool = filtered.length
    ? filtered
    : (PERSONAS.geral.filter((p) => gender === "auto" || p.gender === gender) ??
      PERSONAS.geral);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? PERSONAS.geral[0];
}

const BASE_STYLE =
  "Foto vertical 9:16 realista estilo UGC de celular, iluminação natural, cores vivas, foco nítido no produto, sem texto, sem marca d'água, sem letras na imagem, aparência autêntica de creator brasileiro.";

const ANATOMY_RULES =
  "Anatomia perfeita e realista: exatamente uma cabeça, dois braços e duas mãos visíveis no máximo, cinco dedos por mão, dedos normais e bem formados, nenhuma mão extra, nenhum membro extra, nenhum dedo deformado ou fundido, nenhuma pessoa duplicada ou refletida errada, sem deformações no rosto, olhos simétricos. Evitar: mãos extras, dedos extras, membros deformados, corpo distorcido, artefatos de IA.";

export function buildPresenterPrompts(
  product: { name?: string | null; category?: string | null },
  gender: PresenterGender = "auto",
  persona?: Persona,
): Array<{ id: string; label: string; prompt: string }> {
  const chosen = persona ?? pickPersona(product, gender);
  const p = product.name ?? "o produto";
  const character = `MESMA PESSOA EM TODAS AS CENAS: ${chosen.who}, vestindo ${chosen.outfit}. Mesmo rosto, mesmo cabelo, mesma roupa, mesmo cenário: ${chosen.place}.`;

  return [
    {
      id: "hook",
      label: "Gancho — apresentando",
      prompt: `${character} A pessoa olha para a câmera com expressão animada e segura com UMA das mãos o produto "${p}" (mantenha o produto exatamente igual à imagem de referência, mesmas cores e formato) próximo ao rosto, como se estivesse falando sobre ele. Enquadramento meio corpo. ${BASE_STYLE} ${ANATOMY_RULES}`,
    },
    {
      id: "demo",
      label: "Demonstração",
      prompt: `${character} A pessoa demonstra o produto "${p}" (idêntico à referência) com as duas mãos, mostrando detalhes de perto. Enquadramento mais próximo nas mãos e no produto, rosto parcialmente visível ao fundo. Exatamente duas mãos na cena. ${BASE_STYLE} ${ANATOMY_RULES}`,
    },
    {
      id: "cta",
      label: "Fechamento — CTA",
      prompt: `${character} A pessoa segura o produto "${p}" (idêntico à referência) com as duas mãos, sorrindo, olhando para a câmera. Enquadramento meio corpo, muito espaço livre na parte inferior do quadro. Exatamente duas mãos na cena. ${BASE_STYLE} ${ANATOMY_RULES}`,
    },
  ];
}

export async function generatePresenterScenes(
  product: { name?: string | null; category?: string | null; image_url?: string | null },
  opts?: {
    gender?: PresenterGender;
    onSceneProgress?: (id: string, dataUrl: string, isFinal: boolean) => void;
    signal?: { aborted: boolean };
  },
): Promise<PresenterScene[]> {
  const persona = pickPersona(product, opts?.gender ?? "auto");
  const prompts = buildPresenterPrompts(product, opts?.gender ?? "auto", persona);
  const out: PresenterScene[] = [];
  let characterRef: string | null = null;

  for (const item of prompts) {
    if (opts?.signal?.aborted) break;
    let last: string | null = null;

    const refs: string[] = [];
    if (product.image_url) refs.push(product.image_url);
    if (characterRef) refs.push(characterRef);

    const prompt = characterRef
      ? `${item.prompt} IMPORTANTE: use a segunda imagem de referência como a MESMA pessoa (mesmo rosto, cabelo, roupa e cenário) e a primeira como o produto.`
      : item.prompt;

    await streamImage(
      "/api/generate-image",
      { prompt, imageUrls: refs },
      (dataUrl, isFinal) => {
        last = dataUrl;
        opts?.onSceneProgress?.(item.id, dataUrl, isFinal);
      },
    );
    if (last) {
      out.push({ id: item.id, label: item.label, dataUrl: last });
      if (!characterRef) characterRef = last;
    }
  }

  return out;
}
