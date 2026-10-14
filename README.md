# Finance

Controle financeiro pessoal: receitas, gastos por categoria, quitação de
dívidas e metas de economia — com foco em uma experiência visual clara e
sem fricção.

## Funcionalidades planejadas

- **Receitas** — cadastro do lucro/renda.
- **Gastos por categoria** — lançamentos manuais categorizados (futuramente
  com importação de extratos/Open Finance).
- **Dívidas** — cadastro de dívidas com juros, parcelas e simulação de
  estratégias de quitação (snowball vs. avalanche).
- **Metas de economia** — motor de sugestão de quanto guardar por mês
  (receita − gastos fixos − parcelas de dívida) e acompanhamento de progresso.
- **Dashboard visual** — gráficos claros de evolução de patrimônio, gastos
  por categoria e progresso de dívidas/metas.

## Arquitetura

Monorepo com API e frontend separados desde o início, para permitir criar um
app mobile no futuro reaproveitando a mesma API e os mesmos tipos de domínio.

```
Finance/
├── apps/
│   ├── api/     → backend (Fastify + Prisma + PostgreSQL)
│   └── web/     → frontend (Next.js + Tailwind)
├── packages/
│   └── types/   → schemas/tipos compartilhados (Zod)
├── docker-compose.yml
└── turbo.json
```

### Stack

| Camada         | Tecnologia                                      |
| -------------- | ------------------------------------------------ |
| Backend        | Node.js + TypeScript, Fastify                    |
| Banco de dados | PostgreSQL + Prisma ORM                           |
| Auth           | JWT (`@fastify/jwt`)                              |
| Frontend       | Next.js (App Router) + TypeScript                 |
| Estilo         | Tailwind CSS                                      |
| Gráficos       | Recharts                                          |
| Data fetching  | TanStack Query                                    |
| Monorepo       | pnpm workspaces + Turborepo                       |
| Infra local    | Docker Compose (Postgres + API + Web)             |

**Por que essa stack:** dados financeiros (transações, dívidas, metas) são
fortemente relacionais, o que favorece um banco relacional (PostgreSQL) com
um ORM tipado (Prisma). TypeScript de ponta a ponta permite compartilhar
tipos de domínio (`packages/types`) entre API e frontend, evitando
divergência entre o que o backend retorna e o que o frontend espera — e
facilita reaproveitar a mesma API quando um app mobile (React Native/Expo)
for criado.

### Modelo de domínio (Prisma)

Definido em `apps/api/prisma/schema.prisma`:

- `Category` (INCOME/EXPENSE) → `Transaction` (com `paymentMethod` opcional: `DEBIT`/`CREDIT`); uma categoria EXPENSE pode
  opcionalmente apontar para uma `Debt` (`Category.debtId`)
- `Debt` — só a anotação da dívida (valor total, saldo restante, juros,
  pagamento mínimo) para alimentar a simulação de estratégia; sem histórico
  de pagamentos próprio (ver abaixo)
- `Goal` → `GoalContribution` (histórico de aportes por meta)

## API

### Categorias e transações

- **`GET/POST /categories`**, **`GET/PATCH/DELETE /categories/:id`** — filtro `?kind=INCOME|EXPENSE`; bloqueia nome+tipo duplicado (409) e exclusão de categoria com transações (409). Aceita `debtId` (só em categorias EXPENSE, e só uma dívida do próprio usuário — 400 caso contrário) para vincular a categoria a uma dívida.
- **`GET/POST /transactions`**, **`GET/PATCH/DELETE /transactions/:id`** — filtros `?type=`, `?categoryId=`, `?paymentMethod=DEBIT|CREDIT`, `?from=`/`?to=`; valida que a categoria pertence ao usuário. `paymentMethod` (crédito/débito) é opcional. **Toda transação lançada numa categoria vinculada a uma dívida desconta automaticamente `Debt.remainingAmount`** pelo valor da transação (nunca abaixo de zero); editar o valor ou trocar de categoria ajusta a diferença; apagar a transação reverte o desconto (sem passar de `totalAmount`). Assim, "pagar uma dívida" é só lançar um gasto na categoria certa — não existe um sub-recurso de pagamentos separado. Lógica em `apps/api/src/modules/transactions/debt-sync.ts`.

### Dívidas

- **`GET/POST /debts`**, **`GET/PATCH/DELETE /debts/:id`** — CRUD simples de anotação (nome, valor total, saldo restante, juros, pagamento mínimo). `remainingAmount` é opcional na criação (assume `totalAmount`) e pode ser corrigido a qualquer momento via `PATCH` diretamente.
- **`POST /debts/simulate`** — `{ extraMonthlyPayment?: number }` → simula a quitação de todas as dívidas do usuário mês a mês (juros compostos sobre o saldo, `interestRate` tratada como taxa anual) nas estratégias **snowball** (prioriza o menor saldo) e **avalanche** (prioriza a maior taxa de juros), aplicando o valor extra informado + os mínimos liberados por dívidas já quitadas na dívida prioritária da vez. Retorna `{ snowball, avalanche }`, cada um com `possible`, `months`, `totalInterestPaid`, `debtFreeDate` e `payoffOrder` (ordem e mês em que cada dívida é quitada). Se os pagamentos não cobrirem os juros em até 50 anos, retorna `possible: false` com uma mensagem explicativa em vez de travar. A lógica pura de simulação vive em `apps/api/src/modules/debts/simulate.ts`, testada isoladamente (sem banco) em `tests/simulate.unit.test.ts`.

### Metas

- **`GET/POST /goals`**, **`GET/PATCH/DELETE /goals/:id`** — `currentAmount` é opcional na criação e assume 0 por padrão.
- **`GET/POST /goals/:id/contributions`**, **`DELETE /goals/:id/contributions/:contributionId`** — registrar um aporte cria o histórico (`GoalContribution`) e soma em `currentAmount`; remover reverte o valor.

### Dashboard

- **`GET /dashboard/summary`** — `?from=&to=` (inclusivos; padrão: mês corrente em UTC) e `?months=1..24` (padrão 6). Retorna os números prontos para o dashboard: `totals` (receitas, gastos, saldo) do período, `expensesByCategory` (ordenado do maior para o menor), `expensesByPaymentMethod` (`CREDIT`/`DEBIT`/`unspecified`), `monthly` (série dos últimos `months` meses terminando no mês de `to`, com meses vazios zerados) e o resumo atual de `debts` e `goals`. Somas feitas em centavos inteiros.

Todas as rotas acima exigem `Authorization: Bearer <token>` e só operam sobre dados do próprio usuário (retornam 404 para recursos de outros usuários).

## Autenticação

- **`POST /auth/register`** — `{ email, password, name? }` → cria o usuário e já retorna `{ user, token }`.
- **`POST /auth/login`** — `{ email, password }` → retorna `{ user, token }`.
- **`GET /auth/me`** — protegida, retorna o usuário do token atual.

Todas as demais rotas (`/categories`, `/transactions`, etc.) exigem o header
`Authorization: Bearer <token>` e só enxergam dados do próprio usuário.

Medidas de segurança aplicadas:

- Senhas com hash `bcrypt` (custo 12), nunca retornadas nas respostas.
- Política mínima de senha (8–72 caracteres) validada com Zod.
- Mensagem de erro genérica no login ("Invalid email or password") tanto para
  e-mail inexistente quanto para senha errada, e uso de um hash "dummy" para
  que `bcrypt.compare` sempre rode — evita vazar por tempo de resposta se um
  e-mail está cadastrado (mitigação de user enumeration).
- Rate limiting (`@fastify/rate-limit`) em `/auth/register` e `/auth/login`
  (10 requisições/minuto) contra força bruta.
- Tokens JWT expiram em 7 dias por padrão (`JWT_EXPIRES_IN`).
- Em produção, a API recusa subir se `JWT_SECRET` não tiver sido configurado
  com um valor real.
- **CORS** restrito à(s) origem(ns) configurada(s) em `CORS_ORIGIN` (por
  padrão só `http://localhost:3000`) — não reflete qualquer origem.
- **`@fastify/helmet`** habilitado para os headers de segurança HTTP padrão
  (`X-Content-Type-Options`, `X-Frame-Options`, etc.).

## Testes automatizados

A API tem uma suíte de testes de integração (`apps/api/tests`) usando
**Vitest** + **Testcontainers**: cada execução sobe um Postgres efêmero em
Docker, roda as migrations do Prisma nele, executa a suíte inteira contra a
app real (via `app.inject`, sem precisar abrir uma porta HTTP) e derruba o
container ao final — não usa o banco de desenvolvimento nem deixa rastro.

```bash
pnpm --filter @finance/api test
```

Cobertura atual (83 testes): health check, registro/login/`/me` (incluindo
senha fraca, e-mail duplicado, mensagem genérica de erro no login), rate
limiting em `/auth/login`, CRUD de categorias, transações, dívidas e metas
(incluindo isolamento entre usuários e as regras de conflito/validação), o
vínculo categoria↔dívida e o desconto automático em `remainingAmount` ao
lançar/editar/apagar transações, o motor de simulação de quitação de dívidas
(testes unitários da matemática + testes de integração do endpoint), e os
headers de CORS/Helmet.

Pré-requisito: Docker disponível (o mesmo Docker usado para
`docker-compose.yml`).

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- pnpm (`corepack enable` já disponibiliza o pnpm)
- Docker (para o PostgreSQL, ou para subir tudo via Compose)

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

### 3. Subir o banco de dados

```bash
docker compose up -d postgres
```

### 4. Rodar as migrations do Prisma

```bash
pnpm db:migrate
```

### 5. Rodar API e Web em modo desenvolvimento

```bash
pnpm dev
```

- API: http://localhost:3333 (health check em `/health` e `/health/db`)
- Web: http://localhost:3000

### Alternativa: tudo via Docker Compose

Não precisa de `.env` nem de Node instalado — o compose já define as
variáveis e a API aplica as migrations sozinha ao subir:

```bash
docker compose up --build      # depois: http://localhost:3000
docker compose down            # para tudo (os dados ficam no volume postgres_data)
```

O compose é pensado para uso local (`NODE_ENV=development`, `JWT_SECRET`
padrão). Para um deploy real, defina `NODE_ENV=production` e um
`JWT_SECRET` de verdade — a API se recusa a subir em produção com o padrão.
O código não é montado como volume: depois de mudar algo, rode
`docker compose up --build` de novo (para desenvolver, prefira `pnpm dev`).

## Status atual

Esqueleto inicial do projeto:

- [x] Estrutura de monorepo (pnpm + Turborepo)
- [x] Modelo de dados completo no Prisma
- [x] API Fastify com plugins de Prisma/JWT
- [x] Frontend Next.js + Tailwind com login/cadastro e área logada (dashboard ainda placeholder)
- [x] Docker Compose para ambiente local
- [x] CRUD de categorias (`/categories`) — list (com filtro por `kind`), get, create, update, delete
- [x] CRUD de transações (`/transactions`) — list (com filtros por `type`/`categoryId`/`paymentMethod`/período), get, create, update, delete, validando que a categoria pertence ao usuário
- [x] Autenticação (`/auth/register`, `/auth/login`, `/auth/me`) com bcrypt, rate limiting e expiração de JWT
- [x] CORS restrito por origem configurável + headers de segurança (`@fastify/helmet`)
- [x] Suíte de testes automatizados (Vitest + Testcontainers) cobrindo auth, categorias, transações e headers de segurança
- [x] CRUD de dívidas (`/debts`) — anotação simples (valor, juros, mínimo); categorias vinculadas descontam `remainingAmount` automaticamente ao lançar transações
- [x] CRUD de metas (`/goals`) com histórico de aportes que ajusta `currentAmount`
- [x] Motor de simulação de quitação de dívidas (`POST /debts/simulate`, snowball/avalanche)
- [ ] Motor de sugestão de economia (quanto guardar por mês)
- [ ] Dashboard com gráficos (Recharts)
