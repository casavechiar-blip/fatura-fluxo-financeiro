import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMovimentos } from "@/hooks/use-finance";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import { BudgetConfig, useBudgets } from "@/hooks/use-budgets";
import {
  CATEGORIAS,
  catLabel,
  fmtBRL,
  fmtCompact,
  isProprio,
  isSaida,
  mesKey,
  mesLabel,
  resumoMes,
} from "@/lib/finance";
import { Kpi, MesSelect, Panel } from "@/components/finance/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Finanças" },
      { name: "description", content: "Visão detalhada do fluxo de caixa e saldo acumulado mês a mês com controle de budgets." },
      { property: "og:title", content: "Fluxo de Caixa — Finanças" },
      { property: "og:description", content: "Visão detalhada do fluxo de caixa e saldo acumulado mês a mês com controle de budgets." },
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
  const { budgets, salvarBudget, excluirBudget } = useBudgets();

  const [modalOpen, setModalOpen] = useState(false);
  const [budgetEditando, setBudgetEditando] = useState<BudgetConfig | null>(null);

  const meses = useMemo(() => Array.from(new Set((movs ?? []).map((m) => m.mes.slice(0, 10)))).sort(), [movs]);
  const mes = filtros.mes;
  const sel = mes === "todos" ? null : mes;

  // Cálculo por mês com incorporação do Budget como projeção de gasto mínimo/realizado
  const dados = useMemo(() => {
    const all = movs ?? [];
    const list = sel ? all.filter((m) => mesKey(m.mes) === mesKey(sel)) : all;

    const calcularResumoComBudget = (mesFiltro: string | null) => {
      const sublist = mesFiltro ? all.filter((m) => mesKey(m.mes) === mesKey(mesFiltro)) : all;
      const baseResumo = resumoMes(all, mesFiltro);

      // Calcular o gasto real por cada subcategoria configurada no budget
      const numMeses = mesFiltro ? 1 : Math.max(1, meses.length);

      let adiantamentoBudget = 0; // valor do teto que ainda não foi gasto no mês, mas deve ser considerado já realizado

      budgets.forEach((b) => {
        const tetoPeriodo = b.valorMensal * numMeses;
        const gastoRealCategoria = sublist
          .filter((m) => isSaida(m) && isProprio(m) && m.categoria === b.categoria && m.subcategoria === b.subcategoria)
          .reduce((sum, m) => sum + Number(m.valor), 0);

        if (gastoRealCategoria < tetoPeriodo) {
          // Gasto menor que o budget: adiciona a diferença para projetar o teto total como realizado
          adiantamentoBudget += (tetoPeriodo - gastoRealCategoria);
        }
      });

      const saidasProjetadas = baseResumo.saidasProprias + adiantamentoBudget;
      const saldoProjetado = baseResumo.entradas - saidasProjetadas;

      return {
        ...baseResumo,
        saidasProprias: saidasProjetadas,
        saidasReais: baseResumo.saidasProprias,
        saldo: saldoProjetado,
        adiantamentoBudget,
      };
    };

    let acumulador = 0;
    const mensal = meses.map((m) => {
      const r = calcularResumoComBudget(m);
      acumulador += r.saldo;
      return {
        mes: mesLabel(m),
        Entradas: r.entradas,
        Saídas: r.saidasProprias,
        "Saídas Reais": r.saidasReais,
        Saldo: r.saldo,
        "Saldo Acumulado": acumulador,
      };
    });

    let saldoAcumuladoSelecionado = 0;
    for (const m of meses) {
      const r = calcularResumoComBudget(m);
      saldoAcumuladoSelecionado += r.saldo;
      if (sel && mesKey(m) === mesKey(sel)) break;
    }

    // Progresso dos Budgets para a listagem
    const mesesMultiplicador = sel ? 1 : Math.max(1, meses.length);
    const statusBudgets = budgets.map((b) => {
      const gastoReal = list
        .filter((m) => isSaida(m) && isProprio(m) && m.categoria === b.categoria && m.subcategoria === b.subcategoria)
        .reduce((sum, m) => sum + Number(m.valor), 0);

      const teto = b.valorMensal * mesesMultiplicador;
      const percentual = teto > 0 ? (gastoReal / teto) * 100 : 0;
      const ultrapassou = gastoReal > teto;
      const restante = Math.max(0, teto - gastoReal);
      const diferencaEstouro = Math.max(0, gastoReal - teto);

      return {
        ...b,
        gastoReal,
        teto,
        percentual,
        ultrapassou,
        restante,
        diferencaEstouro,
      };
    });

    return {
      resumo: calcularResumoComBudget(sel),
      saldoAcumulado: sel ? saldoAcumuladoSelecionado : acumulador,
      mensal,
      statusBudgets,
    };
  }, [movs, meses, sel, budgets]);

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
            {r.count} lançamentos · {sel ? mesLabel(sel) : "todos os meses"} · Projeção com tetos de budget
          </p>
        </div>
        <MesSelect meses={meses} value={mes} onChange={setMes} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Entradas" value={fmtBRL(r.entradas)} icon={ArrowUpRight} tone="income" />
        <Kpi
          label="Saídas projetadas"
          value={fmtBRL(r.saidasProprias)}
          icon={ArrowDownRight}
          tone="expense"
          hint={`Reais ${fmtBRL(r.saidasReais)}${r.adiantamentoBudget > 0 ? ` + ${fmtBRL(r.adiantamentoBudget)} reserva teto` : ""}`}
        />
        <Kpi label="Saldo projetado" value={fmtBRL(r.saldo)} icon={PiggyBank} tone="primary" />
        <Kpi
          label="Saldo acumulado"
          value={fmtBRL(dados.saldoAcumulado)}
          icon={TrendingUp}
          tone="primary"
          hint={sel ? `Acumulado até ${mesLabel(sel)}` : "Acumulado total de todos os meses"}
        />
      </div>

      {/* Painel do Gráfico de Fluxo Mensal com Projeção */}
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
            <Bar dataKey="Saídas" fill="var(--expense)" radius={[6, 6, 0, 0]} name="Saídas (Projetadas)" />
            <Line
              type="monotone"
              dataKey="Saldo"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Saldo Projetado"
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

      {/* Seção Indicativa de Budgets / Tetos de Gastos */}
      <Panel
        title="Controle de Budgets e Tetos Mensais"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBudgetEditando(null);
              setModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Novo budget
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dados.statusBudgets.map((b) => {
            const pct = Math.min(100, b.percentual);
            return (
              <div
                key={b.id}
                className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all ${
                  b.ultrapassou
                    ? "border-destructive/60 bg-destructive/10"
                    : "border-border bg-card/60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {catLabel(b.categoria)}
                      </span>
                      <h4 className="text-base font-bold text-foreground">{b.subcategoria}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setBudgetEditando(b);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir o budget de ${b.subcategoria}?`)) {
                            excluirBudget(b.id);
                            toast.success("Budget removido");
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Valores e Metas */}
                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-foreground">
                      Gasto: {fmtBRL(b.gastoReal)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Teto: {fmtBRL(b.teto)}
                    </span>
                  </div>

                  {/* Gráfico de Linha / Escala Graduada de Progresso */}
                  <div className="relative mt-2">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          b.ultrapassou
                            ? "bg-destructive"
                            : b.percentual > 80
                            ? "bg-warning"
                            : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Indicador de Status / Alerta */}
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  {b.ultrapassou ? (
                    <span className="flex items-center gap-1 font-semibold text-destructive">
                      <AlertTriangle className="size-3.5" /> Ultrapassou em {fmtBRL(b.diferencaEstouro)} ({b.percentual.toFixed(0)}%)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Restam {fmtBRL(b.restante)} ({ (100 - b.percentual).toFixed(0) }% livre)
                    </span>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {b.percentual.toFixed(1)}% do teto
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {dados.statusBudgets.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed rounded-xl border-border">
            <Target className="size-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhum budget configurado no momento.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1"
              onClick={() => {
                setBudgetEditando(null);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" /> Definir primeiro budget
            </Button>
          </div>
        )}
      </Panel>

      {/* Modal para Adicionar / Editar Budget */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {budgetEditando ? "Editar Budget Mensal" : "Novo Budget Mensal"}
            </DialogTitle>
          </DialogHeader>
          <BudgetForm
            editando={budgetEditando}
            onSalvar={(novo) => {
              salvarBudget(novo);
              setModalOpen(false);
              toast.success("Budget salvo com sucesso");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BudgetForm({
  editando,
  onSalvar,
}: {
  editando: BudgetConfig | null;
  onSalvar: (b: Omit<BudgetConfig, "id"> & { id?: string }) => void;
}) {
  const catsSaida = CATEGORIAS["Saída"];
  const categoriasList = Object.keys(catsSaida);

  const [categoria, setCategoria] = useState(editando?.categoria ?? "Alimentação");
  const subcategoriasList = catsSaida[categoria] ?? [];
  const [subcategoria, setSubcategoria] = useState(
    editando?.subcategoria ?? (subcategoriasList[0] ?? "")
  );
  const [valorMensal, setValorMensal] = useState(
    editando ? String(editando.valorMensal) : "2000"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(valorMensal.replace(",", "."));
    if (!isFinite(v) || v <= 0) {
      toast.error("Informe um valor mensal válido");
      return;
    }
    if (!categoria || !subcategoria) {
      toast.error("Selecione a categoria e subcategoria");
      return;
    }
    onSalvar({
      ...(editando?.id ? { id: editando.id } : {}),
      categoria,
      subcategoria,
      valorMensal: v,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select
          value={categoria}
          onValueChange={(cat) => {
            setCategoria(cat);
            const subs = catsSaida[cat] ?? [];
            setSubcategoria(subs[0] ?? "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categoriasList.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {catLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Subcategoria</Label>
        <Select value={subcategoria} onValueChange={setSubcategoria}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent>
            {subcategoriasList.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Budget Mensal (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="1"
          required
          value={valorMensal}
          onChange={(e) => setValorMensal(e.target.value)}
          placeholder="Ex: 2000,00"
        />
        <p className="text-xs text-muted-foreground">
          Esse valor será considerado como projeção de gasto mínimo no mês. Conforme você lançar gastos reais nessa subcategoria, o valor será abatido do saldo restante.
        </p>
      </div>

      <Button type="submit" className="w-full">
        Salvar Budget
      </Button>
    </form>
  );
}
