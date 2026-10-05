import { DashShell } from "@/components/DashShell";
import { parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Out Of Sight - Home",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default function HomePage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  return (
    <DashShell
      mockOn={mockOn}
      mockParam={mockOn ? searchParams.mock : undefined}
    />
  );
}
