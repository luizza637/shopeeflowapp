import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Produtos — ShopeeFlow" }] }),
  component: () => (
    <PlaceholderPage
      icon={ShoppingBag}
      title="Produtos"
      description="Aqui você vai buscar produtos da Shopee, filtrar por comissão, vendas ou palavra-chave, e favoritar os melhores. Chega na Fase 2."
      phase="Fase 2"
    />
  ),
});
