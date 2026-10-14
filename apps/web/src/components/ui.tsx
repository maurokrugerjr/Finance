"use client";

import { forwardRef, useState } from "react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  // Texto de ajuda sempre visível (ex.: requisitos da senha); o erro o substitui.
  hint?: string;
  error?: string;
  // Elemento à direita dentro do campo (ex.: botão de mostrar senha).
  trailing?: React.ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, trailing, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? messageId : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-muted/60 focus-visible:ring-2 ${
            error
              ? "border-expense focus-visible:ring-expense/25"
              : "border-line hover:border-muted/50 focus-visible:border-brand focus-visible:ring-brand/20"
          } ${trailing ? "pr-20" : ""} ${className}`}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {message && (
        <p id={messageId} className={`text-sm ${error ? "text-expense" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
});

type PasswordFieldProps = Omit<FieldProps, "type" | "trailing">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls={props.id ?? props.name}
            className="rounded px-2.5 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        }
      />
    );
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "ghost";
};

export function Button({
  loading,
  loadingText = "Aguarde...",
  variant = "primary",
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/60"
      : "text-muted hover:bg-brand-soft hover:text-ink";
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`rounded-md px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {loading ? loadingText : children}
    </button>
  );
}

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border-l-4 border-expense bg-expense/[0.06] px-3 py-2.5 text-sm text-expense"
    >
      {children}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        role="status"
        aria-label="Carregando"
        className="h-8 w-8 rounded-full border-4 border-line border-t-brand motion-safe:animate-spin"
      />
    </div>
  );
}
