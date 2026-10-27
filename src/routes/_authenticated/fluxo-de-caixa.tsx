import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMovimentos } from "@/hooks/use-finance";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import { catLabel, fmtBRL, fmtCompact, isProprio, isSaida, mesKey, mesLabel, resumoMes } from "@/lib/finance";
import { CHART_COLORS, Kpi, MesSelect, Panel } from "@/components/finance/ui";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Finanças" },
      { name: "description", content: "Visão detalhada do fluxo de caixa e saldo acumulado mês a mês." },
      { property: "og:title", content: "Fluxo de Caixa — Finanças" },
      { property: "og:description", content: "Visão detalhada do fluxo de caixa e saldo acumulado mês a mês." },
    ],
  }),
  component: FluxoDeCaixa,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--foreground)",
};

function FluxoDeCaixa() {
  const { data: movs, isLoading } = useMovimentos();
  const { filtros, setMes } = useGlobalFilters();
  const meses = useMemo(() => Array.from(new Set((movs ?? []).map((m) => m.mes.slice(0, 10)))).sort(), [movs]);
  const mes = filtros.mes;
  const sel = mes === "todos" ? null : mes;

  const dados = useMemo(() => {
    const all = movs ?? [];
    const list = sel ? all.filter((m) => mesKey(m.mes) === mesKey(sel)) : all;

    let acumulador = 0;
    const mensal = meses.map((m) => {
      const r = resumoMes(all, m);
      acumulador += r.saldo;
      return {
        mes: mesLabel(m),
        Entradas: r.entradas,
        Saídas: r.saidasProprias,
        Saldo: r.saldo,
        "Saldo Acumulado": acumulador,
      };
    });

    // Se selecionou um mês específico, calculamos o saldo acumulado até aquele mês
    let saldoAcumuladoSelecionado = 0;
    for (const m of meses) {
      const r = resumoMes(all, m);
      saldoAcumuladoSelecionado += r.saldo;
      if (sel && mesKey(m) === mesKey(sel)) break;
    }

    const agg = (key: (x: (typeof list)[number]) => string, filtro: (x: (typeof list)[number]) => boolean) => {
      const map = new Map<string, number>();
      list.filter(filtro).forEach((x) => map.set(key(x), (map.get(key(x)) ?? 0) + Number(x.valor)));
      return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };

    return {
      resumo: resumoMes(all, sel),
      saldoAcumulado: sel ? saldoAcumuladoSelecionado : acumulador,
      mensal,
      categorias: agg((x) => catLabel(x.categoria), (x) => isSaida(x) && isProprio(x)),
    };
  }, [movs, meses, sel]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const r = dados.resumo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Fluxo de caixa</h1>
          <p className="text-sm text-muted-foreground">
            {r.count} lançamentos · {sel ? mesLabel(sel) : "todos os meses"}
          </p>
        </div>
        <MesSelect meses={meses} value={mes} onChange={setMes} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entradas" value={fmtBRL(r.entradas)} icon={ArrowUpRight} tone="income" />
        <Kpi
          label="Saídas próprias"
          value={fmtBRL(r.saidasProprias)}
          icon={ArrowDownRight}
          tone="expense"
          hint={`Pago ${fmtBRL(r.pago)} · Previsto ${fmtBRL(r.previsto)}`}
        />
        <Kpi label="Saldo do período" value={fmtBRL(r.saldo)} icon={PiggyBank} tone="primary" />
        <Kpi
          label="Saldo acumulado"
          value={fmtBRL(dados.saldoAcumulado)}
          icon={TrendingUp}
          tone="primary"
          hint={sel ? `Acumulado até ${mesLabel(sel)}` : "Acumulado total de todos os meses"}
        />
      </div>

      <Panel title="Fluxo mensal e saldo acumulado">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={dados.mensal}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickFormatter={fmtCompact}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => fmtBRL(v)}
              cursor={{ fill: "var(--muted)" }}
            />
            <Legend />
            <Bar dataKey="Entradas" fill="var(--income)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Saídas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="Saldo"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Saldo Acumulado"
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
