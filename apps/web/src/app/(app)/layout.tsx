"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

// Área logada: sem sessão válida, manda para o login.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <FullPageSpinner />;

  const names = user.name.trim().split(/\s+/);
  const firstName = names[0];
  const initials = (names[0]![0]! + (names.length > 1 ? names[names.length - 1]![0]! : "")).toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand">
            Finance
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {/* O nome leva para "Meu plano", onde ficam todas as configurações. */}
            <Link
              href="/plano"
              aria-current={pathname === "/plano" ? "page" : undefined}
              title="Meu plano: renda, categorias e divisão"
              className={`flex items-center gap-2 rounded-md py-1 pl-1 pr-2.5 text-sm font-semibold transition-colors hover:bg-brand-soft ${
                pathname === "/plano" ? "bg-brand-soft text-brand-dark" : "text-ink"
              }`}
            >
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark"
              >
                {initials}
              </span>
              <span className="max-w-[9rem] truncate">{firstName}</span>
              <span className="sr-only">, abrir Meu plano</span>
            </Link>
            <Link
              href="/lancar"
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              Lançar
            </Link>
            <Button variant="ghost" onClick={logout} className="py-1.5">
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
