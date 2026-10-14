"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { loginInput, type LoginInput } from "@finance/types";
import { Alert, Button, Field } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";

type Errors = Partial<Record<keyof LoginInput, string>>;

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const mutation = useMutation({ mutationFn: login });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = loginInput.safeParse(form);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fields.email && "Informe um e-mail válido.",
        password: fields.password && "Informe sua senha.",
      });
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Entrar</h2>

      {mutation.isError && (
        <Alert>{errorMessage(mutation.error, { 401: "E-mail ou senha inválidos." })}</Alert>
      )}

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password}
      />

      <Button type="submit" loading={mutation.isPending} className="mt-2">
        Entrar
      </Button>

      <p className="text-center text-sm text-slate-500">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-emerald-700 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
