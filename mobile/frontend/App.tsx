import { LiveTrackingPreferenceSync } from "@/components/LiveTrackingPreferenceSync";
import { Component, useEffect, useState, type ReactNode, type ComponentType } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ThemeController } from "@/components/ThemeController";
import { AircraftAlertPreferenceSync } from "@/components/AircraftAlertPreferenceSync";
import { TooltipProvider } from "@/components/Tooltip";
import { SwRegistrar } from "@/components/SwRegistrar";
import { SettingsHomeButton } from "@/components/SettingsHomeButton";
import { AppBadge } from "@/components/AppBadge";
import { SpeedWarning } from "@/components/SpeedWarning";
import { SkipLink } from "@/components/SkipLink";
import { RadarShell } from "@/components/RadarShell";
import { RideModeShell } from "@/components/RideModeShell";
import { STARTING_SNAPSHOT, getSpeedWarningEnabled } from "./data";
import { navigate, useLocation, useRevision } from "./navigation";
import Alerts from "./Alerts";
import Help from "./Help";

type PageProps = { params: Record<string, string>; searchParams: Record<string, string> };
type PageModule = { default: (props: PageProps) => ReactNode | Promise<ReactNode>; metadata?: { title?: string } };
type Route = { pattern: RegExp; load: () => Promise<unknown>; names?: string[]; async?: boolean };
const routes: Route[] = [
  { pattern: /^\/home$/, load: () => import("../../app/(tabs)/home/page") },
  { pattern: /^\/settings$/, load: () => import("../../app/(tabs)/settings/page") },
  { pattern: /^\/settings\/display$/, load: () => import("../../app/(tabs)/settings/display/page") },
  { pattern: /^\/aircraft$/, load: () => import("../../app/(tabs)/aircraft/page"), async: true },
  { pattern: /^\/plane\/([A-Za-z0-9]{2,12})$/, names: ["tail"], load: () => import("../../app/(tabs)/plane/[tail]/page"), async: true },
  { pattern: /^\/flight\/([A-Za-z0-9]{2,12})\/(\d{8}T\d{4})$/, names: ["tail", "flightId"], load: () => import("../../app/flight/[tail]/[flightId]/page"), async: true },
  { pattern: /^\/forecast$/, load: () => import("../../app/(tabs)/forecast/page"), async: true },
  { pattern: /^\/about$/, load: () => import("../../app/(tabs)/about/page") },
  { pattern: /^\/legal$/, load: () => import("../../app/(tabs)/legal/page") },
  { pattern: /^\/store$/, load: () => import("../../app/(tabs)/store/page") },
];

function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return <main style={{ maxWidth: 600, margin: "0 auto", padding: "64px 24px", minHeight: "70dvh" }}><h1>Unable to load this screen</h1><p role="alert">{message}</p>{retry && <button onClick={retry}>Try again</button>} <button onClick={() => navigate("/home")}>Home</button></main>;
}
class ScreenBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() { return this.state.error ? <Failure message={this.state.error} retry={() => this.setState({ error: null })} /> : this.props.children; }
}
function Page({ route, props }: { route: Route; props: PageProps }) {
  const [content, setContent] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    void route.load().then(async value => {
      const module = value as PageModule;
      const element = route.async ? await module.default(props) : (() => { const Screen = module.default as ComponentType<PageProps>; return <Screen {...props} />; })();
      if (!cancelled) { document.title = module.metadata?.title ?? "Out Of Sight"; setContent(element); }
    }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Check your connection and try again."); });
    return () => { cancelled = true; };
  }, [route, props, attempt]);
  if (error) return <Failure message={error} retry={() => setAttempt(value => value + 1)} />;
  return content ?? <main role="status" style={{ padding: 32 }}>Loading…</main>;
}
function RouteScreen({ location }: { location: string }) {
  const url = new URL(location, "https://local.oos");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  useEffect(() => {
    if (pathname === "/") navigate("/home", true);
    else if (pathname === "/radar") navigate("/map", true);
    else if (pathname === "/settings/ride") navigate("/settings/display", true);
  }, [pathname]);
  if (pathname === "/" || pathname === "/radar" || pathname === "/settings/ride") return null;
  if (pathname === "/map") return <RadarShell initial={STARTING_SNAPSHOT} initialFocusTail={url.searchParams.get("tail")?.toUpperCase()} />;
  if (pathname === "/ride") return <RideModeShell initial={STARTING_SNAPSHOT} />;
  if (pathname === "/help") return <Help />;
  if (pathname === "/settings/alerts") return <Alerts />;
  const route = routes.find(item => item.pattern.test(pathname));
  if (!route) return <Failure message="This screen isn't available in the app." />;
  const match = route.pattern.exec(pathname)!;
  const params = Object.fromEntries((route.names ?? []).map((name, index) => [name, match[index + 1]!]));
  const searchParams = Object.fromEntries(url.searchParams);
  // Production mobile releases never enable demonstration aircraft through URLs.
  delete searchParams.mock;
  return <Page route={route} props={{ params, searchParams }} />;
}

export default function App() {
  const location = useLocation();
  const revision = useRevision();
  const [speedWarning, setSpeedWarning] = useState(false);
  useEffect(() => { void getSpeedWarningEnabled().then(setSpeedWarning).catch(() => {}); }, []);
  return <><ThemeController /><AircraftAlertPreferenceSync /><LiveTrackingPreferenceSync /><SkipLink /><SiteHeader /><TooltipProvider>
    <ScreenBoundary key={location + revision}><div id="main-content"><RouteScreen location={location} /></div></ScreenBoundary>
    <SettingsHomeButton /><AppBadge /><SpeedWarning enabled={speedWarning} /><SwRegistrar />
  </TooltipProvider></>;
}
