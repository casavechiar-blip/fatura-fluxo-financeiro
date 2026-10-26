import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIAS, PIX, PROPRIO, addMonths, catLabel, gerarParcelas, parseParcelaInfo, type Movimento } from "@/lib/finance";
import { useAtualizarMovimento, useAtualizarSerieParcelada, useCartoes, useMovimentos, useSalvarMovimentos } from "@/hooks/use-finance";

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
  const atualizarSerie = useAtualizarSerieParcelada();
  const hoje = new Date();

  const parcelaInfoInicial = useMemo(() => (editar ? parseParcelaInfo(editar.detalhamento) : null), [editar]);
  const isParcelado = !!parcelaInfoInicial;

  const [tipo, setTipo] = useState<Tipo>((editar?.movimento as Tipo) ?? "Saída");
  const [mes, setMes] = useState((editar?.mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`).slice(0, 7));
  const [categoria, setCategoria] = useState(editar?.categoria ?? "");
  const [sub, setSub] = useState(editar?.subcategoria ?? "");
  const [desc, setDesc] = useState(parcelaInfoInicial ? parcelaInfoInicial.baseDesc : (editar?.detalhamento ?? ""));
  const [forma, setForma] = useState(editar?.forma_pgto ?? PIX);
  const [resp, setResp] = useState(editar?.responsavel ?? PROPRIO);
  const [valor, setValor] = useState(
    editar
      ? parcelaInfoInicial
        ? String(Math.round(Number(editar.valor) * parcelaInfoInicial.total * 100) / 100)
        : String(editar.valor)
      : ""
  );
  const [parcelas, setParcelas] = useState(parcelaInfoInicial ? String(parcelaInfoInicial.total) : "1");
  const [atualizarDemais, setAtualizarDemais] = useState(true);
  const [situacao, setSituacao] = useState(editar?.situacao ?? "Previsto");

  const cats = CATEGORIAS[tipo];
  useEffect(() => {
    if (!editar && !cats[categoria]) { setCategoria(Object.keys(cats)[0] ?? ""); setSub(""); }
  }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const responsaveis = useMemo(
    () => Array.from(new Set([PROPRIO, ...movs.map((m) => m.responsavel).filter(Boolean) as string[]])),
    [movs],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(valor.replace(",", "."));
    if (!isFinite(total) || total === 0) { toast.error("Informe um valor válido"); return; }
    const numParcelas = Math.max(1, Math.floor(Number(parcelas) || 1));

    const base = {
      mes: `${mes}-01`,
      movimento: tipo,
      categoria,
      subcategoria: sub || null,
      detalhamento: desc || null,
      forma_pgto: forma || null,
      responsavel: resp || PROPRIO,
      situacao,
    };

    try {
      if (editar) {
        if (isParcelado && atualizarDemais && parcelaInfoInicial) {
          // Localizar todos os movimentos relacionados à mesma compra parcelada
          // Critério: mesma forma_pgto, responsavel, e detalhamento terminando com " i/total"
          const baseOriginal = parcelaInfoInicial.baseDesc;
          const totalOriginal = parcelaInfoInicial.total;
          const relacionadas = movs.filter((m) => {
            const info = parseParcelaInfo(m.detalhamento);
            if (!info) return false;
            return (
              info.baseDesc === baseOriginal &&
              info.total === totalOriginal &&
              m.forma_pgto === editar.forma_pgto &&
              m.responsavel === editar.responsavel &&
              m.movimento === editar.movimento
            );
          }).sort((a, b) => {
            const ia = parseParcelaInfo(a.detalhamento)?.atual ?? 0;
            const ib = parseParcelaInfo(b.detalhamento)?.atual ?? 0;
            return ia - ib;
          });

          // Determinar mês inicial (da parcela 1)
          const p1 = relacionadas.find((m) => parseParcelaInfo(m.detalhamento)?.atual === 1);
          const mesInicial = p1
            ? p1.mes
            : addMonths(`${mes}-01`, -(parcelaInfoInicial.atual - 1));

          // Calcular valores das novas parcelas
          const valorParcela = Math.round((total / numParcelas) * 100) / 100;
          const itensAtualizar: (Partial<Movimento> & { id: string })[] = [];
          const deletarIds: string[] = [];
          const inserirNovos: NovoMovimento[] = [];

          for (let i = 1; i <= Math.max(numParcelas, totalOriginal); i++) {
            const mesItem = addMonths(mesInicial, i - 1);
            const valItem = i === numParcelas ? Math.round((total - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela;
            const labelItem = numParcelas > 1 ? `${desc || baseOriginal} ${i}/${numParcelas}`.trim() : (desc || baseOriginal);
            const existente = relacionadas.find((m) => parseParcelaInfo(m.detalhamento)?.atual === i);

            if (i <= numParcelas) {
              if (existente) {
                itensAtualizar.push({
                  id: existente.id,
                  ...base,
                  mes: mesItem,
                  valor: valItem,
                  detalhamento: labelItem,
                  situacao: existente.id === editar.id ? situacao : existente.situacao,
                });
              } else {
                inserirNovos.push({
                  ...base,
                  mes: mesItem,
                  valor: valItem,
                  detalhamento: labelItem,
                  situacao: "Previsto",
                });
              }
            } else if (existente) {
              // Quantidade de parcelas diminuiu: remover excedentes
              deletarIds.push(existente.id);
            }
          }

          await atualizarSerie.mutateAsync({
            atualizar: itensAtualizar,
            deletarIds,
            inserir: inserirNovos,
          });

          toast.success(`Compra parcelada atualizada (${numParcelas} parcela(s) sincronizadas)`);
        } else {
          // Atualização simples individual
          const detalhamentoFinal = isParcelado && parcelaInfoInicial
            ? `${desc || parcelaInfoInicial.baseDesc} ${parcelaInfoInicial.atual}/${parcelaInfoInicial.total}`.trim()
            : desc || null;

          await atualizar.mutateAsync({
            id: editar.id,
            ...base,
            valor: total,
            detalhamento: detalhamentoFinal,
            formula: editar.formula && Number(editar.valor) === total ? editar.formula : null,
          });
          toast.success("Lançamento atualizado");
        }
      } else {
        await salvar.mutateAsync(gerarParcelas(base, total, numParcelas));
        toast.success(numParcelas > 1 ? `${numParcelas} parcelas registradas` : "Lançamento registrado");
      }
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
        {responsaveis.includes(resp) ? (
          <Select
            value={resp}
            onValueChange={(v) => {
              if (v === "__novo__") {
                setResp("");
              } else {
                setResp(v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
              <SelectItem value="__novo__" className="font-medium text-primary">
                + Inserir novo responsável...
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={resp}
              onChange={(e) => setResp(e.target.value)}
              placeholder="Nome do novo responsável"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResp(PROPRIO)}
              title="Voltar para a lista"
            >
              Cancelar
            </Button>
          </div>
        )}
      </Field>
      {(!editar || isParcelado) && (
        <Field label={isParcelado ? `Parcelas (${parcelaInfoInicial?.atual}ª parcela)` : "Parcelas"}>
          <Input type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
        </Field>
      )}
      {isParcelado && (
        <div className="col-span-2 flex items-start gap-2.5 rounded-lg border border-border bg-surface/60 p-3 text-xs">
          <Checkbox
            id="atualizar-demais"
            checked={atualizarDemais}
            onCheckedChange={(checked) => setAtualizarDemais(!!checked)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="atualizar-demais" className="cursor-pointer font-medium text-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3.5 text-primary" />
              Sincronizar toda a compra parcelada
            </Label>
            <p className="text-muted-foreground leading-relaxed">
              Atualiza automaticamente o valor, quantidade de parcelas e demais meses desta compra vinculada (recalcula e ajusta todas as parcelas).
            </p>
          </div>
        </div>
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
