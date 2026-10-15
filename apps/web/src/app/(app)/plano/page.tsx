import type { Metadata } from "next";
import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Meu plano" };

export default function PlanPage() {
  return <PlanEditor />;
}
