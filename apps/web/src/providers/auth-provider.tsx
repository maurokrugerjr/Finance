"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginInput, RegisterInput, User } from "@finance/types";
import { apiFetch, getToken, setToken, UNAUTHORIZED_EVENT } from "@/lib/api";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated"; user: null };

type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Ao abrir o app, valida o token salvo (pode ter expirado).
  useEffect(() => {
    if (!getToken()) {
      setState({ status: "unauthenticated", user: null });
      return;
    }
    apiFetch<User>("/auth/me")
      .then((user) => setState({ status: "authenticated", user }))
      .catch(() => {
        setToken(null);
        setState({ status: "unauthenticated", user: null });
      });
  }, []);

  const logout = useCallback(() => {
    // Invalida o token também no servidor; o apiFetch lê o token antes de
    // ele ser apagado logo abaixo. Falha de rede não impede sair localmente.
    if (getToken()) apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    queryClient.clear();
    setState({ status: "unauthenticated", user: null });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const authenticate = useCallback(async (path: string, input: LoginInput | RegisterInput) => {
    const { user, token } = await apiFetch<AuthResponse>(path, {
      method: "POST",
      body: JSON.stringify(input),
    });
    setToken(token);
    setState({ status: "authenticated", user });
  }, []);

  const login = useCallback((input: LoginInput) => authenticate("/auth/login", input), [authenticate]);
  const register = useCallback(
    (input: RegisterInput) => authenticate("/auth/register", input),
    [authenticate],
  );

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
