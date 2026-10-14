import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted pelo Next no build (sem requisição ao Google em runtime, o que
// também mantém o CSP com font-src 'self').
const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// O nonce do CSP (src/middleware.ts) muda a cada requisição, então as páginas
// não podem ser pré-renderizadas estaticamente.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Finance", template: "%s | Finance" },
  description: "Controle financeiro pessoal: gastos por categoria, dívidas e metas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
