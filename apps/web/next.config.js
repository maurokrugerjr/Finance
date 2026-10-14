/** @type {import('next').NextConfig} */

// Cabeçalhos estáticos; o Content-Security-Policy (com nonce por requisição)
// é definido em src/middleware.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Navegadores ignoram HSTS em HTTP puro; passa a valer quando servido via HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@finance/types"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
