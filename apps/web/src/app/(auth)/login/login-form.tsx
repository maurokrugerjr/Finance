"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { loginInput } from "@finance/types";
import { Alert, Button, Field, PasswordField } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { focusFirstError } from "../form-utils";

const FIELDS = ["email", "password"] as const;
type FieldName = (typeof FIELDS)[number];
type Errors = Partial<Record<FieldName, string>>;

export function LoginForm() {
  const { login } = useAuth();
  const [form, setForm] = useState<Record<FieldName, string>>({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const mutation = useMutation({ mutationFn: login });

  // Ao editar um campo, o erro dele some: a pessoa vê que já está corrigindo.
  function update(name: FieldName, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = loginInput.safeParse(form);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      const nextErrors: Errors = {
        email: fields.email && "Digite um e-mail válido, como nome@exemplo.com.",
        password: fields.password && "Digite sua senha.",
      };
      setErrors(nextErrors);
      focusFirstError(FIELDS, nextErrors);
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="mt-1 text-muted">Use o e-mail e a senha que você cadastrou.</p>
      </div>

      {mutation.isError && (
        <Alert>
          {errorMessage(mutation.error, {
            401: "E-mail ou senha incorretos. Confira os dois e tente de novo.",
          })}
        </Alert>
      )}

      <Field
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        error={errors.email}
      />
      <PasswordField
        label="Senha"
        name="password"
        autoComplete="current-password"
        value={form.password}
        onChange={(e) => update("password", e.target.value)}
        error={errors.password}
      />

      <Button type="submit" loading={mutation.isPending} loadingText="Entrando..." className="mt-1">
        Entrar
      </Button>

      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-brand underline-offset-2 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
