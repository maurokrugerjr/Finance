"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { HowItWorks } from "./how-it-works";

// Telas públicas (login/cadastro): quem já está logado vai direto para o app.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status !== "unauthenticated") return <FullPageSpinner />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* No celular o formulário vem primeiro; a explicação fica logo abaixo. */}
      <main className="flex flex-col px-4 py-8 sm:px-10 lg:py-12">
        <p className="text-lg font-bold text-brand">Finance</p>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
      <aside className="flex items-center bg-brand-soft px-4 py-12 sm:px-10">
        <HowItWorks />
      </aside>
    </div>
  );
}
