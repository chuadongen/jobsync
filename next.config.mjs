// In a GitHub Codespace the app is reached through a forwarding proxy whose
// host differs from the one Next sees, which server actions reject as a
// cross-origin request. Allow exactly that forwarded host, and nothing else.
const codespaceHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-3737.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"}`
  : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(codespaceHost && {
    allowedDevOrigins: [codespaceHost],
    experimental: { serverActions: { allowedOrigins: [codespaceHost, "localhost:3737"] } },
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
