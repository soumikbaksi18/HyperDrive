import type { Metadata } from "next";
import { BasketView } from "@/components/baskets/basket-view";

export const metadata: Metadata = {
  title: "Baskets",
};

export default function BasketsPage() {
  return <BasketView />;
}
