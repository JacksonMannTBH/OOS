/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // Brand asset path migration. The old PWA had its manifest at
  // /manifest.webmanifest and root-level icons; the canonical bundle
  // lives under /icons/ with a static /manifest.json. These permanent
  // redirects keep already-installed PWAs from breaking.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "admin.outofsight.live" }],
        destination: "/admin/requests",
        permanent: false,
      },
      {
        source: "/manifest.webmanifest",
        destination: "/manifest.json",
        permanent: true,
      },
      {
        source: "/icon-192.png",
        destination: "/icons/icon-192.png",
        permanent: true,
      },
      {
        source: "/icon-512.png",
        destination: "/icons/icon-512.png",
        permanent: true,
      },
      {
        source: "/og.png",
        destination: "/icons/og-image.png",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
