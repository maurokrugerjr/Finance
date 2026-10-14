// Move o foco para o primeiro campo com erro (na ordem do formulário), para
// quem usa teclado ou leitor de tela cair direto no que precisa corrigir.
export function focusFirstError(order: readonly string[], errors: Record<string, string | undefined>) {
  const first = order.find((name) => errors[name]);
  if (first) document.getElementById(first)?.focus();
}
