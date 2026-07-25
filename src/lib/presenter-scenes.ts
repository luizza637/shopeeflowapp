// Gera cenas com "apresentador IA": imagens fotorrealistas de uma pessoa
// segurando/usando o produto, para que o vídeo não seja apenas voz + foto.
// O perfil do apresentador varia automaticamente conforme a categoria/nome
// do produto (moda feminina, eletrônicos, casa, beleza, fitness, etc.).

import { streamImage } from "@/lib/stream-image";

export type PresenterScene = {
  id: string;
  label: string;
  dataUrl: string;
};

type Persona = {
  who: string;
  place: string;
};

const PERSONAS: Record<string, Persona[]> = {
  beleza: [
    { who: "mulher brasileira de 24 anos, cabelo ondulado castanho, pele luminosa", place: "banheiro claro e organizado com espelho e plantas" },
    { who: "mulher brasileira de 32 anos, cabelo liso escuro, maquiagem natural", place: "penteadeira aconchegante com luz de anel suave" },
  ],
  moda: [
    { who: "mulher brasileira de 27 anos, estilo casual moderno", place: "quarto claro com espelho de corpo inteiro" },
    { who: "mulher brasileira de 30 anos, sorriso espontâneo", place: "sala minimalista com luz natural da janela" },
  ],
  eletronicos: [
    { who: "homem brasileiro de 29 anos, barba curta, camiseta lisa", place: "mesa de escritório em casa com luz suave" },
    { who: "mulher brasileira de 26 anos, óculos, look moderno", place: "bancada clara com notebook desfocado ao fundo" },
  ],
  casa: [
    { who: "mulher brasileira de 35 anos, look confortável", place: "cozinha clara e arrumada, luz natural" },
    { who: "homem brasileiro de 33 anos, camisa clara", place: "sala de estar aconchegante com sofá bege" },
  ],
  fitness: [
    { who: "mulher brasileira de 25 anos, roupa de treino", place: "academia moderna com iluminação difusa" },
    { who: "homem brasileiro de 28 anos, atlético, roupa de treino", place: "sala de treino em casa com tapete e halteres" },
  ],
  infantil: [
    { who: "mãe brasileira de 31 anos, sorriso caloroso", place: "quarto infantil claro e alegre" },
  ],
  geral: [
    { who: "mulher brasileira de 28 anos, aparência simpática e natural", place: "ambiente doméstico claro com luz natural" },
    { who: "homem brasileiro de 30 anos, aparência simpática e natural", place: "ambiente doméstico claro com luz natural" },
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

function pickPersona(product: {
  name?: string | null;
  category?: string | null;
}): Persona {
  const hay = `${product.category ?? ""} ${product.name ?? ""}`;
  let bucket: keyof typeof PERSONAS = "geral";
  for (const [re, key] of KEYWORDS) {
    if (re.test(hay)) {
      bucket = key;
      break;
    }
  }
  const list = PERSONAS[bucket];
  // variação automática (determinística pelo nome, mas alterna entre execuções)
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] ?? PERSONAS.geral[0];
}

const BASE_STYLE =
  "Foto vertical 9:16 realista estilo UGC de celular, iluminação natural, cores vivas, foco nítido no produto, sem texto, sem marca d'água, sem letras na imagem, aparência autêntica de creator brasileiro.";

export function buildPresenterPrompts(product: {
  name?: string | null;
  category?: string | null;
}): Array<{ id: string; label: string; prompt: string }> {
  const persona = pickPersona(product);
  const p = product.name ?? "o produto";
  const subject = `${persona.who}, em ${persona.place}`;

  return [
    {
      id: "hook",
      label: "Gancho — apresentando",
      prompt: `${subject}. Ela/ele olha para a câmera com expressão animada e segura o produto "${p}" (mantenha o produto exatamente igual à imagem de referência, mesmas cores e formato) próximo ao rosto, como se estivesse falando sobre ele. Enquadramento meio corpo. ${BASE_STYLE}`,
    },
    {
      id: "demo",
      label: "Demonstração",
      prompt: `${subject}. A pessoa está usando/demonstrando o produto "${p}" (idêntico à referência) com as mãos, mostrando detalhes de perto. Enquadramento mais próximo nas mãos e no produto, rosto parcialmente visível ao fundo. ${BASE_STYLE}`,
    },
    {
      id: "cta",
      label: "Fechamento — CTA",
      prompt: `${subject}. A pessoa segura o produto "${p}" (idêntico à referência) com as duas mãos, sorrindo e apontando para a câmera, como se indicasse o link de compra. Enquadramento meio corpo, muito espaço livre na parte inferior do quadro. ${BASE_STYLE}`,
    },
  ];
}

export async function generatePresenterScenes(
  product: { name?: string | null; category?: string | null; image_url?: string | null },
  opts?: {
    onSceneProgress?: (id: string, dataUrl: string, isFinal: boolean) => void;
    signal?: { aborted: boolean };
  },
): Promise<PresenterScene[]> {
  const prompts = buildPresenterPrompts(product);
  const out: PresenterScene[] = [];

  for (const item of prompts) {
    if (opts?.signal?.aborted) break;
    let last: string | null = null;
    await streamImage(
      "/api/generate-image",
      { prompt: item.prompt, imageUrl: product.image_url ?? null },
      (dataUrl, isFinal) => {
        last = dataUrl;
        opts?.onSceneProgress?.(item.id, dataUrl, isFinal);
      },
    );
    if (last) out.push({ id: item.id, label: item.label, dataUrl: last });
  }

  return out;
}
