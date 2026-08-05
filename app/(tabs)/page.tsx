import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function Page({
  searchParams,
}: {
  searchParams: SP;
}) {
  const mock = searchParams.mock
    ? `?mock=${encodeURIComponent(searchParams.mock)}`
    : "";
  redirect(`/home${mock}`);
}
