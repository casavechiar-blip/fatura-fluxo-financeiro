import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS, PIX, PROPRIO, catLabel, gerarParcelas, type Movimento } from "@/lib/finance";
import { useAtualizarMovimento, useCartoes, useMovimentos, useSalvarMovimentos } from "@/hooks/use-finance";

type Tipo = "Entrada" | "Saída";

export function NovoLancamentoButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-glow">
          <Plus className="size-4" /> Novo lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        {open && <LancamentoForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function LancamentoForm({ onDone, editar }: { onDone: () => void; editar?: Movimento }) {
  const { data: cartoes = [] } = useCartoes();
  const { data: movs = [] } = useMovimentos();
  const salvar = useSalvarMovimentos();
  const atualizar = useAtualizarMovimento();
  const hoje = new Date();
  const [tipo, setTipo] = useState<Tipo>((editar?.movimento as Tipo) ?? "Saída");
  const [mes, setMes] = useState((editar?.mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`).slice(0, 7));
  const [categoria, setCategoria] = useState(editar?.categoria ?? "");
  const [sub, setSub] = useState(editar?.subcategoria ?? "");
  const [desc, setDesc] = useState(editar?.detalhamento ?? "");
  const [forma, setForma] = useState(editar?.forma_pgto ?? PIX);
  const [resp, setResp] = useState(editar?.responsavel ?? PROPRIO);
  const [valor, setValor] = useState(editar ? String(editar.valor) : "");
  const [parcelas, setParcelas] = useState("1");
  const [situacao, setSituacao] = useState(editar?.situacao ?? "Previsto");

  const cats = CATEGORIAS[tipo];
  useEffect(() => {
    if (!editar && !cats[categoria]) { setCategoria(Object.keys(cats)[0]); setSub(""); }
  }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const responsaveis = useMemo(
    () => Array.from(new Set([PROPRIO, ...movs.map((m) => m.responsavel).filter(Boolean) as string[]])),
    [movs],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(valor.replace(",", "."));
    if (!isFinite(total) || total === 0) return toast.error("Informe um valor válido");
    const base = {
      mes: `${mes}-01`, movimento: tipo, categoria, subcategoria: sub || null, detalhamento: desc || null,
      forma_pgto: forma || null, responsavel: resp || PROPRIO, situacao,
    };
    try {
      if (editar) await atualizar.mutateAsync({ id: editar.id, ...base, valor: total, formula: editar.formula && Number(editar.valor) === total ? editar.formula : null });
      else await salvar.mutateAsync(gerarParcelas(base, total, Number(parcelas)));
      toast.success(editar ? "Lançamento atualizado" : "Lançamento registrado");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4">
      <div className="col-span-2 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        {(["Saída", "Entrada"] as Tipo[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTipo(t)}
            className={`rounded-md py-2 text-sm font-semibold transition ${tipo === t ? (t === "Saída" ? "bg-expense text-primary-foreground" : "bg-income text-primary-foreground") : "text-muted-foreground"}`}
          >
            {t === "Saída" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>
      <Field label="Valor total (R$)">
        <Input inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
      </Field>
      <Field label="Mês de referência">
        <Input type="month" required value={mes} onChange={(e) => setMes(e.target.value)} />
      </Field>
      <Field label="Categoria">
        <Select value={categoria} onValueChange={(v) => { setCategoria(v); setSub(""); }}>
          <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>{Object.keys(cats).map((c) => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Subcategoria">
        <Select value={sub} onValueChange={setSub}>
          <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>{(cats[categoria] ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Descrição" full>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: mercado, luz, tênis…" />
      </Field>
      <Field label="Forma de pagamento / cartão">
        <Select value={forma} onValueChange={setForma}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PIX}>{PIX}</SelectItem>
            {cartoes.map((c) => <SelectItem key={c.id} value={c.nome}>💳 {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Responsável">
        <Input list="responsaveis" value={resp} onChange={(e) => setResp(e.target.value)} />
        <datalist id="responsaveis">{responsaveis.map((r) => <option key={r} value={r} />)}</datalist>
      </Field>
      {!editar && (
        <Field label="Parcelas">
          <Input type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
        </Field>
      )}
      <Field label="Situação">
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Previsto">Previsto</SelectItem>
            <SelectItem value="Pago">Pago</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" className="col-span-2" disabled={salvar.isPending || atualizar.isPending}>
        {editar ? "Salvar alterações" : Number(parcelas) > 1 ? `Registrar ${parcelas} parcelas` : "Registrar"}
      </Button>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "col-span-2" : "col-span-2 sm:col-span-1"}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
