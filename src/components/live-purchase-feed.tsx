import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";

type FeedProduct = {
  name: string;
  image_url?: string | null;
};

const BUYERS = [
  "Mariana",
  "Camila",
  "Ana Paula",
  "Jéssica",
  "Fernanda",
  "Patrícia",
  "Larissa",
  "Bianca",
  "Juliana",
  "Renata",
];

export function LivePurchaseFeed({
  products = [],
}: {
  products?: FeedProduct[];
}) {
  const [index, setIndex] = useState(0);
  const items = useMemo(() => {
    const source = products.length ? products.slice(0, 8) : [{ name: "um achadinho" }];
    return source.map((product, i) => ({
      product,
      buyer: BUYERS[i % BUYERS.length],
      quantity: 1 + (i % 3),
    }));
  }, [products]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % items.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);

  const current = items[index % items.length];
  if (!current) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)] animate-sf-pop-in rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-elevated backdrop-blur sm:max-w-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/15">
          {current.product.image_url ? (
            <img
              src={current.product.image_url}
              alt="Produto comprado"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ShoppingBag className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">
            {current.buyer} acabou de comprar
          </p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {current.quantity}x {current.product.name}
          </p>
        </div>
      </div>
    </div>
  );
}
