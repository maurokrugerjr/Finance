import { ApiError } from "./api";

// Traduz erros da API para mensagens amigáveis; `overrides` permite
// mensagens específicas por status em cada tela.
export function errorMessage(error: unknown, overrides: Record<number, string> = {}) {
  if (error instanceof ApiError) {
    if (overrides[error.status]) return overrides[error.status];
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
    if (error.status >= 500) return "O servidor teve um problema. Tente novamente em instantes.";
    return error.message;
  }
  if (error instanceof TypeError) return "Não foi possível conectar ao servidor.";
  return "Algo deu errado. Tente novamente.";
}
