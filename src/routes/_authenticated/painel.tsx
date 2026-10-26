import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMovimentos } from "@/hooks/use-finance";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import { catLabel, fmtBRL, fmtCompact, isProprio, isSaida, mesKey, mesLabel, resumoMes } from "@/lib/finance";
import { CHART_COLORS, Kpi, MesSelect, Panel } from "@/components/finance/ui";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Finanças" },
      { name: "description", content: "Visão geral de receitas, despesas, categorias e cartões." },
      { property: "og:title", content: "Painel — Finanças" },
      { property: "og:description", content: "Visão geral de receitas, despesas, categorias e cartões." },
    ],
  }),
  component: Painel,
});

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--foreground)" };

function Painel() {
  const { data: movs, isLoading } = useMovimentos();
  const { filtros, setMes } = useGlobalFilters();
  const meses = useMemo(() => Array.from(new Set((movs ?? []).map((m) => m.mes.slice(0, 10)))).sort(), [movs]);
  const mes = filtros.mes;
  const sel = mes === "todos" ? null : mes;

  const dados = useMemo(() => {
    const all = movs ?? [];
    const list = sel ? all.filter((m) => mesKey(m.mes) === mesKey(sel)) : all;
    const mensal = meses.map((m) => { const r = resumoMes(all, m); return { mes: mesLabel(m), Entradas: r.entradas, Saídas: r.saidasProprias, Terceiros: r.terceiros, Saldo: r.saldo }; });
    const agg = (key: (x: (typeof list)[number]) => string, filtro: (x: (typeof list)[number]) => boolean) => {
      const map = new Map<string, number>();
      list.filter(filtro).forEach((x) => map.set(key(x), (map.get(key(x)) ?? 0) + Number(x.valor)));
      return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    return {
      resumo: resumoMes(all, sel),
      mensal,
      categorias: agg((x) => catLabel(x.categoria), (x) => isSaida(x) && isProprio(x)),
      cartoes: agg((x) => x.forma_pgto ?? "—", (x) => isSaida(x) && !!x.forma_pgto),
      terceiros: agg((x) => x.responsavel ?? "—", (x) => isSaida(x) && !isProprio(x)),
      top: list.filter(isSaida).sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 6),
    };
  }, [movs, meses, sel]);

  if (isLoading) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const r = dados.resumo;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Painel financeiro</h1>
          <p className="text-sm text-muted-foreground">{r.count} lançamentos · {sel ? mesLabel(sel) : "todos os meses"}</p>
        </div>
        <MesSelect meses={meses} value={mes} onChange={setMes} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entradas" value={fmtBRL(r.entradas)} icon={ArrowUpRight} tone="income" />
        <Kpi label="Saídas próprias" value={fmtBRL(r.saidasProprias)} icon={ArrowDownRight} tone="expense" hint={`Pago ${fmtBRL(r.pago)} · Previsto ${fmtBRL(r.previsto)}`} />
        <Kpi label="Saldo do período" value={fmtBRL(r.saldo)} icon={PiggyBank} tone="primary" />
        <Kpi label="Compras de terceiros" value={fmtBRL(r.terceiros)} icon={Users} tone="chart-3" hint="A receber de outras pessoas" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Fluxo mensal" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados.mensal}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={fmtCompact} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} cursor={{ fill: "var(--muted)" }} />
              <Legend />
              <Bar dataKey="Entradas" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Saídas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Terceiros" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              <Line dataKey="Saldo" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Despesas por categoria">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dados.categorias} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                {dados.categorias.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1.5 text-sm">
            {dados.categorias.map((c, i) => (
              <li key={c.name} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{fmtBRL(c.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Gastos por forma de pagamento">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados.cartoes} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={110} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Terceiros (a receber)">
          <ul className="space-y-3">
            {dados.terceiros.map((t, i) => {
              const max = dados.terceiros[0]?.value || 1;
              return (
                <li key={t.name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{t.name}</span><span className="tabular-nums">{fmtBRL(t.value)}</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${(t.value / max) * 100}%`, background: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} /></div>
                </li>
              );
            })}
            {!dados.terceiros.length && <p className="text-sm text-muted-foreground">Nada no período.</p>}
          </ul>
        </Panel>
        <Panel title="Maiores despesas">
          <ul className="divide-y divide-border">
            {dados.top.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.detalhamento || m.subcategoria}</p>
                  <p className="text-xs text-muted-foreground">{mesLabel(m.mes)} · {m.forma_pgto ?? "—"}</p>
                </div>
                <span className="tabular-nums text-expense">{fmtBRL(Number(m.valor))}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
