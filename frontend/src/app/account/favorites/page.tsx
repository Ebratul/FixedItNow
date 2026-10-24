import type { Metadata } from "next";
import { FavoritesList } from "@/components/account/favorites-list";

export const metadata: Metadata = {
  title: "Favorites",
  robots: { index: false },
};

export default function FavoritesPage() {
  return (
    <div className="container-page section-y">
      <FavoritesList />
    </div>
  );
}
