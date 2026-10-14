// Painel didático das telas de login/cadastro: mostra, com exemplos pequenos,
// o que a pessoa vai conseguir fazer no app. Valores são ilustrativos.

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const exampleCategories = [
  { name: "Moradia", share: 45 },
  { name: "Alimentação", share: 30 },
  { name: "Transporte", share: 25 },
];

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-x-4 pb-8 last:pb-0">
      {/* Linha vertical ligando os passos (é uma sequência de uso). */}
      <span aria-hidden className="absolute bottom-0 left-4 top-9 w-px bg-brand/25 [li:last-child>&]:hidden" />
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
      >
        {number}
      </span>
      <div className="flex flex-col gap-1 pt-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-title" className="mx-auto w-full max-w-md">
      <h2 id="how-it-works-title" className="text-2xl font-bold leading-tight sm:text-3xl">
        Saiba para onde vai cada real
      </h2>
      <p className="mt-2 text-muted">
        O Finance junta seus gastos, dívidas e metas num só lugar. Funciona assim:
      </p>

      <ol className="mt-8">
        <Step
          number={1}
          title="Lance o gasto"
          description="Informe o valor, a categoria e se foi no crédito ou no débito."
        >
          <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 tabular-nums">
            <div>
              <p className="font-semibold">Mercado</p>
              <p className="text-sm text-muted">Alimentação, no débito</p>
            </div>
            <p className="font-semibold text-expense">− {brl(312.4)}</p>
          </div>
        </Step>

        <Step
          number={2}
          title="Veja o resumo do mês"
          description="Seus gastos aparecem agrupados por categoria."
        >
          <ul className="flex flex-col gap-2 rounded-lg bg-white px-4 py-3">
            {exampleCategories.map((category) => (
              <li key={category.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span>{category.name}</span>
                <span className="h-2 rounded-full bg-brand-soft">
                  <span className="block h-2 rounded-full bg-brand" style={{ width: `${category.share}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted">{category.share}%</span>
              </li>
            ))}
          </ul>
        </Step>

        <Step
          number={3}
          title="Planeje dívidas e metas"
          description="Acompanhe quanto falta e simule quando cada dívida termina."
        >
          <div className="rounded-lg bg-white px-4 py-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Cartão de crédito</span>
              <span className="tabular-nums text-muted">60% pago</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-brand-soft">
              <div className="h-2 w-[60%] rounded-full bg-brand" />
            </div>
            <p className="mt-2 text-sm tabular-nums text-muted">
              Faltam {brl(1200)} de {brl(3000)}
            </p>
          </div>
        </Step>
      </ol>

      <p className="mt-6 text-sm text-muted">Os valores acima são apenas um exemplo.</p>
    </section>
  );
}
