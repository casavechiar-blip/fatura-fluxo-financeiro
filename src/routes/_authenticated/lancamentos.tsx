import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useExcluirMovimento, useMovimentos } from "@/hooks/use-finance";
import { catLabel, fmtBRL, isSaida, mesKey, mesLabel, type Movimento } from "@/lib/finance";
import { MesSelect, Panel } from "@/components/finance/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LancamentoForm } from "@/components/finance/novo-lancamento";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Finanças" },
      { name: "description", content: "Todas as receitas e despesas, com filtros por mês, categoria e cartão." },
      { property: "og:title", content: "Lançamentos — Finanças" },
      { property: "og:description", content: "Todas as receitas e despesas, com filtros." },
    ],
  }),
  component: Lancamentos,
});

function Lancamentos() {
  const { data: movs = [] } = useMovimentos();
  const excluir = useExcluirMovimento();
  const [mes, setMes] = useState("todos");
  const [forma, setForma] = useState("todas");
  const [responsavel, setResponsavel] = useState("todos");
  const [q, setQ] = useState("");
  const [editar, setEditar] = useState<Movimento | null>(null);
  const meses = useMemo(() => Array.from(new Set(movs.map((m) => m.mes))).sort(), [movs]);
  const formas = useMemo(() => Array.from(new Set(movs.map((m) => m.forma_pgto).filter(Boolean) as string[])).sort(), [movs]);
  const responsaveis = useMemo(() => Array.from(new Set(movs.map((m) => m.responsavel).filter(Boolean) as string[])).sort(), [movs]);

  const lista = movs.filter((m) =>
    (mes === "todos" || mesKey(m.mes) === mesKey(mes)) &&
    (forma === "todas" || m.forma_pgto === forma) &&
    (responsavel === "todos" || m.responsavel === responsavel) &&
    (!q || [m.detalhamento, m.subcategoria, m.categoria, m.responsavel].join(" ").toLowerCase().includes(q.toLowerCase())),
  );
  const total = lista.reduce((s, m) => s + (isSaida(m) ? -1 : 1) * Number(m.valor), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Lançamentos</h1>
        <p className="text-sm text-muted-foreground">{lista.length} itens · saldo filtrado {fmtBRL(total)}</p>
      </div>
      <Panel
        title="Filtros"
        action={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input className="w-48 pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <MesSelect meses={meses} value={mes} onChange={setMes} />
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as formas</SelectItem>
                {formas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Mês</th><th className="pr-3">Descrição</th><th className="pr-3">Categoria</th>
                <th className="pr-3">Pagamento</th><th className="pr-3">Responsável</th><th className="pr-3">Situação</th>
                <th className="pr-3 text-right">Valor</th><th />
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="py-2 pr-3 whitespace-nowrap">{mesLabel(m.mes)}</td>
                  <td className="pr-3">{m.detalhamento || "—"}</td>
                  <td className="pr-3"><span className="text-foreground">{catLabel(m.categoria)}</span><br /><span className="text-xs text-muted-foreground">{m.subcategoria}</span></td>
                  <td className="pr-3 whitespace-nowrap">{m.forma_pgto ?? "—"}</td>
                  <td className="pr-3">{m.responsavel}</td>
                  <td className="pr-3"><Badge variant={m.situacao === "Pago" ? "default" : "secondary"}>{m.situacao}</Badge></td>
                  <td className={`pr-3 text-right tabular-nums whitespace-nowrap ${isSaida(m) ? "text-expense" : "text-income"}`}>
                    {isSaida(m) ? "−" : "+"} {fmtBRL(Number(m.valor))}
                  </td>
                  <td className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditar(m)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => { if (confirm("Excluir este lançamento?")) excluir.mutate(m.id, { onSuccess: () => toast.success("Excluído") }); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog open={!!editar} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
          {editar && <LancamentoForm editar={editar} onDone={() => setEditar(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
