# Continuar amanhã

Cole isto no início de uma sessão nova do Claude Code para retomar o contexto:

---

Continuando o projeto Finance (app de controle financeiro pessoal). Monorepo
pnpm + Turborepo: apps/api (Fastify + Prisma + PostgreSQL), apps/web
(Next.js, ainda placeholder), packages/types (schemas Zod compartilhados).

Antes de mexer em qualquer coisa, leia CLAUDE.md (arquitetura, comandos,
padrões dos módulos) e README.md (lista de funcionalidades, endpoints da
API e a seção "Status atual").

Resumo do que já existe:
- Auth completo (registro/login/me) com bcrypt, rate limiting, JWT com
  expiração de 7 dias
- CRUD de categorias e transações (transação com crédito/débito opcional;
  não existe conceito de conta bancária — é só um dashboard de gastos)
- CRUD de dívidas (só anotação — nome/valor/juros/mínimo, sem histórico de
  pagamentos) + simulação de quitação snowball/avalanche em
  POST /debts/simulate
- Categoria de gasto pode ser vinculada a uma dívida (Category.debtId) —
  lançar uma transação nela desconta automaticamente o saldo da dívida
  (create/update/delete todos sincronizam)
- CRUD de metas com histórico de aportes (GoalContribution)
- CORS restrito por CORS_ORIGIN + Helmet
- 76 testes automatizados (Vitest + Testcontainers, Postgres efêmero por
  execução, sem tocar no banco de dev)

Ainda falta:
- Motor de sugestão de economia (quanto guardar por mês, com base em
  receita − gastos fixos − parcelas de dívida)
- Frontend de verdade — hoje é só uma página inicial placeholder; falta
  telas de login/cadastro, dashboard com gráficos (Recharts), e CRUD visual
  de categorias/transações/dívidas/metas

Ideia futura: importar gastos automaticamente a partir dos e-mails de
comprovante do banco no Gmail (IA extrai valor/data/crédito-débito e sugere
categoria; gastos importados entram como pendentes para revisão; guardar o
id da mensagem para não duplicar; cuidado com compra no crédito + pagamento
de fatura contando duas vezes).

Quero continuar com: [ESCREVA AQUI O QUE VOCÊ QUER FAZER — ex: "implementa
o motor de sugestão de economia" ou "começa o frontend/dashboard"]
