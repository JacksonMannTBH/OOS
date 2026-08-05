import { DashShell } from "@/components/DashShell";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Out Of Sight - Home",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const real = await getSnapshotForRender();
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return (
    <DashShell
      initial={initial}
      mockOn={mockOn}
      mockParam={mockOn ? searchParams.mock : undefined}
    />
  );
}
