import type { Metadata } from "next";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "Lançar" };

export default function NewTransactionPage() {
  return <TransactionForm />;
}
