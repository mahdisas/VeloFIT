import { MobileMembership } from "@/components/mobile/mobile-membership";
import { MobileProducts } from "@/components/mobile/mobile-products";
import { MobileTopTabs } from "@/components/mobile/mobile-top-tabs";
import { getAppViewer } from "@/lib/app-viewer";
import { getPackagesFor } from "@/lib/finance/packages-server";
import { getProductsFor } from "@/lib/finance/products-server";

/** Shop — Membership (the gym's packages) and Products (the in-app store). */
export default async function ShopPage() {
  const viewer = await getAppViewer();
  const [packages, products] = await Promise.all([
    getPackagesFor(viewer.supabase, viewer.gymId),
    getProductsFor(viewer.supabase, viewer.gymId),
  ]);
  const memberships = packages.filter((p) => p.showInApp && p.isActive);
  const store = products.filter((p) => p.showInApp && p.isActive);

  return (
    <MobileTopTabs
      tabs={[
        { value: "membership", label: "Membership", content: <MobileMembership packages={memberships} /> },
        { value: "products", label: "Products", content: <MobileProducts products={store} /> },
      ]}
    />
  );
}
