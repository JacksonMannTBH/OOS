import { RadarShell } from "@/components/RadarShell";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Map",
};

export const dynamic = "force-dynamic";

type SearchParams = { mock?: string };

export default async function MapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const snapshot = await getSnapshotForRender();
  const mockState = parseMockState(searchParams.mock);
  return (
    <RadarShell
      initial={applyMockState(snapshot, mockState)}
      mockOn={mockState !== null}
    />
  );
}
