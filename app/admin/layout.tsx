import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "Out Of Sight Admin",
  manifest: "/admin/manifest.json",
  appleWebApp: {
    capable: true,
    title: "OOS Admin",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
