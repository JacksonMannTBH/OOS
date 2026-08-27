import { AircraftCatalogView } from "@/components/AircraftCatalogView";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";

export const metadata = {
  title: "Aircraft Catalog",
  description: "Tracked aircraft catalog and published endurance estimates.",
};

export const dynamic = "force-dynamic";

export default async function AircraftCatalogPage() {
  const catalog = await getAircraftCatalogEntries();

  return <AircraftCatalogView catalog={catalog} />;
}
