"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { registerInput } from "@finance/types";
import { Alert, Button, Field, PasswordField } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { focusFirstError } from "@/lib/form";

const FIELDS = ["name", "email", "password", "confirmPassword"] as const;
type FieldName = (typeof FIELDS)[number];
type Errors = Partial<Record<FieldName, string>>;

export function RegisterForm() {
  const { register } = useAuth();
  const [form, setForm] = useState<Record<FieldName, string>>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const mutation = useMutation({ mutationFn: register });

  // Ao editar um campo, o erro dele some: a pessoa vê que já está corrigindo.
  function update(name: FieldName, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = registerInput.safeParse({
      name: form.name,
      email: form.email,
      password: form.password,
    });

    const fields = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    const nextErrors: Errors = {
      name: fields.name && (form.name.trim() ? "Use no máximo 120 caracteres." : "Digite seu nome."),
      email: fields.email && "Digite um e-mail válido, como nome@exemplo.com.",
      password:
        fields.password &&
        (form.password.length < 8
          ? "A senha precisa ter pelo menos 8 caracteres."
          : "Senha longa demais. Use até 72 caracteres (letras com acento contam como 2)."),
      confirmPassword:
        form.confirmPassword !== form.password
          ? "As senhas não são iguais. Digite a mesma senha nos dois campos."
          : undefined,
    };
    setErrors(nextErrors);

    if (!parsed.success || nextErrors.confirmPassword) {
      focusFirstError(FIELDS, nextErrors);
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Criar sua conta</h1>
        <p className="mt-1 text-muted">Leva menos de um minuto. Depois é só lançar seus gastos.</p>
      </div>

      {mutation.isError && (
        <Alert>
          {errorMessage(mutation.error, {
            409: "Já existe uma conta com este e-mail. Entre com ele ou use outro e-mail.",
          })}
        </Alert>
      )}

      <Field
        label="Nome"
        name="name"
        autoComplete="name"
        autoFocus
        hint="É assim que o app vai chamar você."
        value={form.name}
        onChange={(e) => update("name", e.target.value)}
        error={errors.name}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="Você vai usar este e-mail para entrar."
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        error={errors.email}
      />
      <PasswordField
        label="Senha"
        name="password"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
        value={form.password}
        onChange={(e) => update("password", e.target.value)}
        error={errors.password}
      />
      <PasswordField
        label="Confirme a senha"
        name="confirmPassword"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(e) => update("confirmPassword", e.target.value)}
        error={errors.confirmPassword}
      />

      <Button type="submit" loading={mutation.isPending} loadingText="Criando conta..." className="mt-1">
        Criar conta
      </Button>

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
