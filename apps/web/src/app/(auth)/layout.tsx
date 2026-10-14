"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

// Telas públicas (login/cadastro): quem já está logado vai direto para o app.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status !== "unauthenticated") return <FullPageSpinner />;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-slate-500">Seu controle financeiro pessoal</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
