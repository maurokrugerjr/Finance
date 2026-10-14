"use client";

import { useAuth } from "@/providers/auth-provider";

export default function HomePage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Olá{firstName ? `, ${firstName}` : ""}!</h1>
      <p className="text-slate-500">O dashboard vai aparecer aqui.</p>
    </div>
  );
}
