export type Route = {
  name: string;
  path: string;
  settleMs?: number;
  testsTz?: boolean;
  riderFacing?: boolean;
  a11y?: boolean;
  pwa?: boolean;
};

export const ROUTES: Route[] = [
  { name: "home-default", path: "/", settleMs: 1500, riderFacing: true, a11y: true, pwa: true, testsTz: true },
  { name: "home-mock-up", path: "/?mock=up", settleMs: 1500, riderFacing: true, a11y: true },
  { name: "home-mock-down", path: "/?mock=down", settleMs: 1500, riderFacing: true, a11y: true },
  { name: "map", path: "/map", settleMs: 3500, riderFacing: true, a11y: true, testsTz: true },
  { name: "forecast", path: "/forecast", settleMs: 1500, riderFacing: true, a11y: true, testsTz: true },
  { name: "about", path: "/about", settleMs: 1000, riderFacing: true, a11y: true },
  { name: "legal", path: "/legal", settleMs: 1000, riderFacing: true, a11y: true },
  { name: "help", path: "/help", settleMs: 1000, riderFacing: true, a11y: true },
  { name: "admin-login", path: "/admin", settleMs: 1000, a11y: true },
  { name: "404", path: "/this-page-does-not-exist", settleMs: 1000, riderFacing: true, a11y: true },
  { name: "plane-N305DK", path: "/plane/N305DK", settleMs: 2000, riderFacing: true, a11y: true, testsTz: true },
];
