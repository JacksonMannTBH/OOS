import { DashShell } from "@/components/DashShell";
import { DEFAULT_APP_STATE_ID } from "@/lib/app-states";
import { getSnapshotForRender } from "@/lib/snapshot";
import { getRecentActivity } from "@/lib/activity";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Out Of Sight · Dash",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function DashPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const [real, activity] = await Promise.all([
    getSnapshotForRender(),
    getRecentActivity(5, DEFAULT_APP_STATE_ID),
  ]);
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return <DashShell initial={initial} initialActivity={activity} mockOn={mockOn} />;
}
