# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Projeto

Controle financeiro pessoal (receitas, gastos por categoria, estratégia de quitação de dívidas, metas de economia). Veja `README.md` para a lista de funcionalidades e a referência completa da API — este arquivo foca no que é preciso saber para trabalhar no código.

## Estrutura do monorepo

pnpm workspaces + Turborepo. Três pacotes:

- `apps/api` — backend Fastify 5 + TypeScript + Prisma + PostgreSQL. É onde praticamente toda a lógica mora hoje.
- `apps/web` — frontend Next.js (App Router) + Tailwind. Por enquanto é só uma página inicial placeholder (`src/app/page.tsx`) e um helper `apiFetch` básico (`src/lib/api.ts`) — ainda não há telas reais, fluxo de auth ou data fetching implementados.
- `packages/types` — schemas Zod compartilhados entre `api` e `web` (tipos de domínio + schemas de input de create/update + schemas de auth). As duas apps importam de `@finance/types`; quando um campo muda num model do Prisma, o schema Zod correspondente aqui quase sempre precisa mudar também.

API e frontend são propositalmente desacoplados (processos separados — Fastify e Next.js — se comunicando via HTTP) para permitir que um futuro app mobile (React Native/Expo) reaproveite a mesma API e o mesmo `@finance/types` sem retrabalho.

## Comandos

Rodar a partir da raiz do repo, salvo indicação contrária.

```bash
pnpm install                    # instala as dependências de todo o workspace
pnpm dev                        # turbo: roda api + web em paralelo
pnpm build                      # turbo: builda todos os pacotes
pnpm db:migrate                 # prisma migrate dev, restrito a apps/api
pnpm db:studio                  # prisma studio, restrito a apps/api
docker compose up -d postgres   # só o Postgres de dev local
docker compose up --build       # stack completa (postgres + api + web) via Docker
```

Restrito a `apps/api` (via `pnpm --filter @finance/api <script>` a partir da raiz, ou entrando em `apps/api` antes):

```bash
pnpm dev                        # tsx watch src/server.ts
pnpm build                      # tsc -p tsconfig.json (gera em dist/)
pnpm lint                       # tsc -p tsconfig.json --noEmit (só src)
pnpm typecheck:tests            # tsc -p tsconfig.test.json --noEmit (src + tests)
pnpm test                       # vitest run — suíte completa, sobe um Postgres efêmero
```

Rodando um único arquivo de teste ou um teste específico (a partir de `apps/api`):

```bash
pnpm exec vitest run tests/debts.test.ts
pnpm exec vitest run -t "creates a debt"
```

Restrito a `apps/web`: `pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint` (scripts padrão do Next.js).

Restrito a `packages/types`: sem etapa de build — é consumido como código TypeScript direto (`main`/`types` apontam para `src/index.ts`), então editar esse pacote já reflete nas duas apps sem precisar rebuildar.

## Arquitetura do backend (`apps/api`)

**Formato dos módulos.** Cada domínio mora em `src/modules/<nome>/routes.ts`, exportando um `FastifyPluginAsync` registrado em `src/app.ts` sob um prefixo (`/auth`, `/categories`, `/transactions`, `/debts`, `/goals`, `/dashboard`, `/health`). Todo módulo, exceto `auth` e `health`, começa com `app.addHook("preHandler", app.authenticate)` e restringe toda query do Prisma por `request.user.userId` — não existe visibilidade entre usuários em lugar nenhum, e novas rotas devem seguir esse padrão (buscar já filtrando por `userId` no `where`, não buscar e depois checar).

**Auth** (`src/plugins/auth.ts`): `@fastify/jwt` decora `request.user` como `{ userId: string }`. Tokens são assinados com expiração padrão de 7 dias (`JWT_EXPIRES_IN`). A aplicação recusa subir se `NODE_ENV=production` e `JWT_SECRET` ainda estiver com o valor placeholder padrão — isso é intencional, não relaxar essa checagem.

**Tratamento de Decimal.** O Prisma guarda valores monetários como `Decimal`. Cada módulo de rota tem seu próprio helper `serialize*` convertendo campos `Decimal` para `number` antes de mandar o JSON (ex.: `serializeDebt`, `serializeGoal`, `serialize` em transactions). Ao adicionar um novo campo monetário ou endpoint, lembrar de converter — o contrato da API (e o `@finance/types`) espera `number`, não string de Decimal.

**Sincronização Dívida ↔ Categoria ↔ Transação — o principal comportamento que atravessa múltiplos arquivos.** Essa é a única lógica de negócio que não fica óbvia olhando um arquivo isolado:

- `Debt` é propositalmente só uma anotação (nome, `totalAmount`, `remainingAmount`, `interestRate`, `minimumPayment`), **sem sub-recurso de histórico de pagamentos**. Para corrigir um saldo manualmente, `PATCH /debts/:id`.
- `Category` tem um `debtId` opcional (só válido quando `kind = EXPENSE`, e só apontando para uma dívida do mesmo usuário — validado em `modules/categories/routes.ts` na função `validateDebtLink`).
- Toda `Transaction` lançada numa categoria vinculada a uma dívida ajusta automaticamente o `remainingAmount` dessa dívida. Essa lógica vive em `modules/transactions/debt-sync.ts` (`applyDebtPayment`, `reverseDebtPayment`, `syncDebtsForTransactionChange`) e é chamada em `modules/transactions/routes.ts` dentro de blocos `$transaction` no create/update/delete. Editar o valor de uma transação ou movê-la entre duas categorias vinculadas a dívidas diferentes acerta a diferença corretamente (reverte a dívida antiga, aplica na nova); apagar reverte. Os saldos ficam limitados ao intervalo `[0, totalAmount]`.
- Em contraste, `Goal`/`GoalContribution` ainda usa um sub-recurso explícito de aportes (`POST/GET /goals/:id/contributions`, `DELETE .../:contributionId`) que ajusta `currentAmount` diretamente — dívidas e metas **não** são simétricas de propósito (isso veio de um feedback de produto no meio da construção; não "corrigir" essa assimetria sem confirmar antes).

**Simulação de quitação de dívidas** (`modules/debts/simulate.ts`, exposta em `POST /debts/simulate`): uma função pura (sem imports de Prisma/Fastify), por isso tem seu próprio arquivo de teste unitário (`tests/simulate.unit.test.ts`) separado do teste de integração da rota. Faz amortização mês a mês em centavos inteiros (evita deriva de ponto flutuante), suporta ordenação **SNOWBALL** (menor saldo primeiro) e **AVALANCHE** (maior `interestRate` primeiro) fixada no início da simulação, repassa o pagamento mínimo liberado por uma dívida quitada para a próxima dívida prioritária, e tem um teto de 600 meses — além disso retorna `{ possible: false, message }` em vez de rodar para sempre. `interestRate` é tratada como percentual anual em toda a simulação.

**Middlewares de segurança relevantes antes de mexer em `app.ts`:** `@fastify/helmet`, `@fastify/rate-limit` (registrado com `global: false` — as rotas aderem via `config.rateLimit` por rota, usado hoje só em `/auth/register` e `/auth/login`), e CORS restrito a `CORS_ORIGIN` (lista separada por vírgula, padrão `http://localhost:3000` — nunca configurar isso para refletir qualquer origem).

## Arquitetura de testes (`apps/api/tests`)

Testes de integração de verdade: chamam a app Fastify real via `app.inject()` contra um Postgres real (efêmero), não mocks. Mecânicas-chave, nenhuma óbvia só olhando os arquivos de teste:

- `tests/global-setup.ts` sobe um `PostgreSqlContainer` (Testcontainers) uma vez por execução de `vitest run`, define `DATABASE_URL`/`JWT_SECRET`/`CORS_ORIGIN`/`AUTH_RATE_LIMIT_MAX` em `process.env`, e roda `prisma migrate deploy` contra ele. O container é derrubado em `teardown()`.
- `vitest.config.ts` define `fileParallelism: false` (junto com `isolate: false` e `poolOptions.threads.singleThread`) **de propósito** — todo arquivo de teste dá `TRUNCATE` em todas as tabelas via `resetDatabase()` no `beforeEach`, e deixar o Vitest intercalar arquivos de teste contra o mesmo banco já causou falhas reais de condição de corrida (o `TRUNCATE` de um arquivo apagando linhas que o `beforeEach` de outro tinha acabado de inserir) antes disso ser configurado. Não remover isso para "acelerar".
- `AUTH_RATE_LIMIT_MAX` é lido no **momento de registro do plugin** dentro de `modules/auth/routes.ts` (não no momento de import do módulo) especificamente para os testes poderem sobrescrevê-lo: a app compartilhada (via `getTestApp()` em `tests/helpers.ts`) recebe um limite bem alto do global-setup, enquanto `tests/rate-limit.test.ts` monta sua própria instância isolada via `buildApp()` depois de abaixar temporariamente a env var, podendo assim de fato disparar e verificar um 429 sem prejudicar as chamadas de login/registro de todos os outros testes.
- `tests/helpers.ts` tem as fixtures compartilhadas: `getTestApp()` (instância de app memoizada), `resetDatabase()`, `registerUser()` (passa pelo endpoint real `/auth/register`, retorna um `authHeader` pronto pra usar), `createCategory()`, `createDebt()`.
