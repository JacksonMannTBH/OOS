import { notFound } from "next/navigation";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { isSupportedStateCode, type StateCode } from "@/lib/app-states";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";
import { getMostRecentFlightForTail } from "@/lib/flights";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";
import { AircraftProfile } from "@/components/AircraftProfile";

export const dynamic = "force-dynamic";

type Props = {
  params: { tail: string };
  searchParams: { mock?: string; state?: string };
};

export async function generateMetadata({ params }: Props) {
  return { title: params.tail.toUpperCase() };
}

export default async function PlanePage({ params, searchParams }: Props) {
  const tail = params.tail.toUpperCase();
  const catalog = await getAircraftCatalogEntries();
  const catalogEntry = catalog.find(item => item.aircraft.tail === tail);
  if (!catalogEntry) notFound();
  const stateCode = isSupportedStateCode(searchParams.state)
    ? searchParams.state.toUpperCase() as StateCode
    : catalogEntry.homeStateCode;
  const [snapshot, recentFlight] = await Promise.all([
    getSnapshotForRender(stateCode),
    getMostRecentFlightForTail(tail, null),
  ]);
  return <AircraftProfile
    catalogEntry={catalogEntry}
    initialSnapshot={applyMockState(snapshot, parseMockState(searchParams.mock))}
    initialFlight={recentFlight}
    stateCode={stateCode}
    mock={searchParams.mock}
    hour12={isHour12(getTimeFormatPref())}
  />;
}
