import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "Painel" };

export default function DashboardPage() {
  // useSearchParams (mês em ?mes=) precisa de um Suspense acima.
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
