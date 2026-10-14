const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

const TOKEN_KEY = "finance.token";

// Disparado quando a API recusa o token (expirado/inválido); o AuthProvider
// escuta esse evento para deslogar o usuário.
export const UNAUTHORIZED_EVENT = "finance:unauthorized";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage indisponível (ex.: modo privado restrito): segue só em memória.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    // Erros do Fastify vêm como { statusCode, error, message }.
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
