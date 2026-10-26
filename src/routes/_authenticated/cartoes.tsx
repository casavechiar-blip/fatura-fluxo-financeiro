import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCartoes, useExcluirCartao, useFaturas, useMovimentos, useSalvarCartao, useSalvarFatura } from "@/hooks/use-finance";
import { useGlobalFilters } from "@/hooks/use-global-filters";
import { conferirFaturas, fmtBRL, mesLabel } from "@/lib/finance";
import { MesSelect, Panel } from "@/components/finance/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões e faturas — Finanças" },
      { name: "description", content: "Confira o total registrado de cada cartão contra o valor da fatura." },
      { property: "og:title", content: "Cartões e faturas — Finanças" },
      { property: "og:description", content: "Confira o total registrado de cada cartão contra a fatura." },
    ],
  }),
  component: Cartoes,
});

function Cartoes() {
  const { user } = Route.useRouteContext();
  const { data: movs = [] } = useMovimentos();
  const { data: cartoes = [] } = useCartoes();
  const { data: faturas = [] } = useFaturas();
  const { filtros, setMes } = useGlobalFilters();
  const salvarFatura = useSalvarFatura();
  const salvarCartao = useSalvarCartao();
  const excluirCartao = useExcluirCartao();
  const meses = useMemo(() => Array.from(new Set(movs.map((m) => m.mes))).sort(), [movs]);
  const mesSel = (filtros.mes && filtros.mes !== "todos") ? filtros.mes : (meses[0] || "");
  const conf = mesSel ? conferirFaturas(movs, faturas, cartoes.map((c) => c.nome), mesSel) : [];
  const [novo, setNovo] = useState({ nome: "", vencimento: "10" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Cartões e faturas</h1>
          <p className="text-sm text-muted-foreground">Digite o total da fatura e compare com o que foi registrado no app.</p>
        </div>
        {meses.length > 0 && <MesSelect meses={meses} value={mesSel} onChange={setMes} todos={false} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {conf.map((c) => {
          const cartao = cartoes.find((x) => x.nome === c.cartao)!;
          const ok = c.diferenca !== null && Math.abs(c.diferenca) < 0.01;
          return (
            <div key={c.cartao} className="panel p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg p-2" style={{ background: `color-mix(in oklab, var(--${cartao.cor ?? "chart-1"}) 18%, transparent)`, color: `var(--${cartao.cor ?? "chart-1"})` }}>
                    <CreditCard className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{c.cartao}</p>
                    <p className="text-xs text-muted-foreground">Vence dia {cartao.vencimento}</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remover cartão" onClick={() => confirm(`Remover ${c.cartao}?`) && excluirCartao.mutate(cartao.id)}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Registrado no app</dt><dd className="tabular-nums">{fmtBRL(c.registrado)}</dd></div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Fatura {mesLabel(mesSel)}</dt>
                  <Input
                    key={`${c.cartao}-${mesSel}-${c.fatura}`}
                    className="h-8 w-28 text-right"
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={c.fatura ?? ""}
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(",", "."));
                      if (e.target.value === "" || !isFinite(v) || v === c.fatura) return;
                      salvarFatura.mutate({ cartao: c.cartao, mes: mesSel, valor: v, user_id: user.id }, { onSuccess: () => toast.success("Fatura salva") });
                    }}
                  />
                </div>
              </dl>
              {c.diferenca !== null && (
                <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${ok ? "bg-income/10 text-income" : "bg-warning/10 text-warning"}`}>
                  {ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                  {ok ? "Fatura conferida" : `Diferença de ${fmtBRL(c.diferenca)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Panel title="Adicionar cartão">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvarCartao.mutate({ nome: novo.nome, vencimento: Number(novo.vencimento) }, { onSuccess: () => { toast.success("Cartão adicionado"); setNovo({ nome: "", vencimento: "10" }); } });
          }}
        >
          <div className="space-y-1.5"><Label>Nome</Label><Input required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Inter 10" /></div>
          <div className="space-y-1.5"><Label>Dia do vencimento</Label><Input type="number" min={1} max={31} required className="w-28" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} /></div>
          <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
        </form>
      </Panel>
    </div>
  );
}
