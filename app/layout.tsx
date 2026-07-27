import type { Metadata, Viewport } from "next";
import { BASE_URL } from "@/lib/config";
import { IOSInstallPrompt } from "@/components/IOSInstallPrompt";
import { SwRegistrar } from "@/components/SwRegistrar";
import { TooltipProvider } from "@/components/Tooltip";
import { ThemeController } from "@/components/ThemeController";
import { SiteHeader } from "@/components/SiteHeader";
import { getContrastPref } from "@/lib/user-prefs";
import "./globals.css";

const TITLE = "Out Of Sight";
const DESCRIPTION =
  "Live WSP and sheriff aircraft tracker for Washington state riders.";
const SOCIAL_DESCRIPTION =
  "Live aircraft tracker for Washington state riders.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: TITLE, template: "%s - Out Of Sight" },
  description: DESCRIPTION,
  applicationName: "Out Of Sight",
  manifest: "/manifest.json",
  // iOS PWA standalone-mode flags. Without these the home-screen install
  // launches in a degraded "kinda-Safari" shell — wrong status bar, no
  // app-icon label fallback, brand voice broken on first paint.
  appleWebApp: {
    capable: true,
    title: "Out Of Sight",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/out-of-sight-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/out-of-sight-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/out-of-sight-favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/out-of-sight-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "mask-icon", url: "/icons/safari-pinned-tab.svg", color: "#f6c431" },
    ],
  },
  openGraph: {
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    type: "website",
    siteName: "Out Of Sight",
    url: "/",
    images: [
      { url: "/icons/out-of-sight-og-image.png", width: 1200, height: 630, alt: "Out Of Sight" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    images: ["/icons/out-of-sight-og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#020202",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contrast = getContrastPref();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className="ss-app"
        data-contrast={contrast}
        data-theme="dark"
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme='dark';document.body.dataset.theme='dark';document.documentElement.style.colorScheme='dark';var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content','#050607');localStorage.setItem('ss_radar_dark_mode','1')}catch(e){}",
          }}
        />
        <ThemeController />
        <SiteHeader />
        <TooltipProvider>
          {children}
          <IOSInstallPrompt />
          <SwRegistrar />
        </TooltipProvider>
      </body>
    </html>
  );
}
