"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

// Área logada: sem sessão válida, manda para o login.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <FullPageSpinner />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold tracking-tight">Finance</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.name ?? user.email}</span>
            <Button variant="ghost" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
