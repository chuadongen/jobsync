/** @type {import('next').NextConfig} */
const nextConfig = {
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
