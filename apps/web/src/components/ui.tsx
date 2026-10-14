import { forwardRef } from "react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-slate-900 outline-none transition focus:ring-2 ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({
  loading,
  variant = "primary",
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {loading ? "Aguarde..." : children}
    </button>
  );
}

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        aria-label="Carregando"
        className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600"
      />
    </div>
  );
}
