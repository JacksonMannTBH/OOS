import { redirect } from "next/navigation";

export const metadata = {
  title: "Activity",
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  redirect("/home");
}
