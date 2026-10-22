// In a GitHub Codespace the app is reached through a forwarding proxy whose
// host differs from the one Next sees, which server actions reject as a
// cross-origin request. Allow exactly that forwarded host, and nothing else.
const codespaceHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-3737.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`
  : null;

// Behind a reverse proxy (tailscale serve, Caddy) the browser's origin is the
// public address while the forwarded host may be localhost. Allow the address
// in NEXTAUTH_URL. Read at build time, so the Docker build receives it.
const publicHost = (() => {
  try {
    return process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : null;
  } catch {
    return null;
  }
})();

const allowedOrigins = [codespaceHost, publicHost].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(codespaceHost && { allowedDevOrigins: [codespaceHost] }),
  ...(allowedOrigins.length > 0 && {
    experimental: { serverActions: { allowedOrigins: [...allowedOrigins, "localhost:3737"] } },
  }),
  output: "standalone",
  // Rendered on the server only; bundling it breaks its font loading.
  serverExternalPackages: ["@react-pdf/renderer"],
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
