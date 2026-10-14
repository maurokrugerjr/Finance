"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { registerInput } from "@finance/types";
import { Alert, Button, Field } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";

type Errors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>;

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Errors>({});
  const mutation = useMutation({ mutationFn: register });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = registerInput.safeParse({
      email: form.email,
      password: form.password,
      name: form.name.trim() || undefined,
    });

    const fields = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    const nextErrors: Errors = {
      name: fields.name && "Nome muito longo.",
      email: fields.email && "Informe um e-mail válido.",
      password: fields.password && "A senha precisa ter entre 8 e 72 caracteres.",
      confirmPassword:
        form.password !== form.confirmPassword ? "As senhas não conferem." : undefined,
    };
    setErrors(nextErrors);

    if (!parsed.success || nextErrors.confirmPassword) return;
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Criar conta</h2>

      {mutation.isError && (
        <Alert>{errorMessage(mutation.error, { 409: "Este e-mail já está cadastrado." })}</Alert>
      )}

      <Field
        label="Nome (opcional)"
        name="name"
        autoComplete="name"
        autoFocus
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        error={errors.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={errors.password}
      />
      <Field
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        error={errors.confirmPassword}
      />

      <Button type="submit" loading={mutation.isPending} className="mt-2">
        Criar conta
      </Button>

      <p className="text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
