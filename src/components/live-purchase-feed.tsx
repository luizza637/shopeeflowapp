import { useEffect, useState } from "react";
import { ShoppingBag, Users } from "lucide-react";

const NAMES = [
  "Maria",
  "Ana",
  "Juliana",
  "Fernanda",
  "Camila",
  "Patrícia",
  "Larissa",
  "Beatriz",
  "Carla",
  "Bruna",
  "Lucas",
  "João",
  "Pedro",
  "Rafael",
  "Thiago",
  "Gabriel",
  "Marcos",
  "Vitória",
  "Sabrina",
  "Aline",
];

const CITIES = [
  "SP",
  "RJ",
  "MG",
  "BA",
  "PR",
  "RS",
  "PE",
  "CE",
  "SC",
  "GO",
];

const ACTIONS = ["acabou de comprar", "garantiu", "levou", "aproveitou"];

type Item = { id: number; text: string; product: string };

export function LivePurchaseFeed({ products }: { products: { name: string }[] }) {
  const [item, setItem] = useState<Item | null>(null);
  const [buyers, setBuyers] = useState(0);
  const [watching, setWatching] = useState(0);

  useEffect(() => {
    setBuyers(28 + Math.floor(Math.random() * 90));
    setWatching(4 + Math.floor(Math.random() * 14));
    const pulse = setInterval(() => {
      setWatching((w) => Math.max(3, Math.min(28, w + (Math.random() > 0.5 ? 1 : -1))));
    }, 6000);
    return () => clearInterval(pulse);
  }, []);

  useEffect(() => {
    if (!products.length) return;
    let timeout: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    let n = 0;

    const schedule = (delay: number) => {
      timeout = setTimeout(() => {
        const p = products[Math.floor(Math.random() * products.length)];
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        setItem({
          id: ++n,
          text: `${name} de ${city} ${action}`,
          product: p.name,
        });
        setBuyers((b) => b + 1);
        hide = setTimeout(() => setItem(null), 4800);
        schedule(7000 + Math.random() * 8000);
      }, delay);
    };

    schedule(2500);
    return () => {
      clearTimeout(timeout);
      clearTimeout(hide);
    };
  }, [products]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <ShoppingBag className="h-3.5 w-3.5 animate-sf-wiggle" />
          {buyers} compras hoje
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <Users className="h-3.5 w-3.5" />
          {watching} pessoas vendo agora
        </span>
      </div>

      <div
        aria-live="polite"
        className="pointer-events-none fixed left-1/2 top-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2"
      >
        {item && (
          <div
            key={item.id}
            className="flex animate-sf-pop-in items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 p-3 shadow-[0_20px_50px_-24px_var(--primary)] backdrop-blur"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShoppingBag className="h-4 w-4 animate-sf-wiggle" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary">{item.text}</p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                {item.product}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
