import { RadarShell } from "@/components/RadarShell";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Map",
};

export const dynamic = "force-dynamic";

type SearchParams = { mock?: string; tail?: string };

export default async function MapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const snapshot = await getSnapshotForRender();
  const mockState = parseMockState(searchParams.mock);
  const initialFocusTail = normalizeTailParam(searchParams.tail);
  return (
    <RadarShell
      initial={applyMockState(snapshot, mockState)}
      mockOn={mockState !== null}
      initialFocusTail={initialFocusTail}
    />
  );
}

function normalizeTailParam(tail: string | undefined): string | undefined {
  const normalized = tail?.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9]{2,12}$/.test(normalized)) return undefined;
  return normalized;
}
