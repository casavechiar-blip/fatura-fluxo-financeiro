import type { Database } from "@/integrations/supabase/types";

export type Movimento = Database["public"]["Tables"]["movimentos"]["Row"];
export type NovoMovimento = Database["public"]["Tables"]["movimentos"]["Insert"];
export type Cartao = Database["public"]["Tables"]["cartoes"]["Row"];
export type Fatura = Database["public"]["Tables"]["faturas"]["Row"];

export const PROPRIO = "RECURSO PROPRIO";
export const PIX = "Pix / Boleto / Debito";

/** Category tree copied from the spreadsheet's "Categorias" tab. */
export const CATEGORIAS: Record<"Entrada" | "Saída", Record<string, string[]>> = {
  Entrada: {
    Receita: ["Salário e benefícios", "Renda extra", "Entrada de terceiros", "Outras receitas"],
  },
  Saída: {
    Moradia: ["Financiamento e condomínio", "Contas da casa", "Manutenção e serviços", "Móveis e decoração"],
    PessoalSaude: ["Saúde e medicamentos", "Academia e bem-estar", "Vestuário e cuidados pessoais", "Compras pessoais"],
    Financeiro: ["Investimentos e reservas", "Transferências internas", "Taxas, juros e impostos", "Ajustes e estornos"],
    Familia: ["Ajuda financeira", "Compras de terceiros", "Despesas compartilhadas", "Presentes e contribuições"],
    Alimentação: ["Mercado", "Restaurantes e delivery", "Padaria, feira e açougue", "Outros alimentos"],
    Transporte: ["Financiamento e documentação", "Combustível e pedágios", "Manutenção e seguro", "Aplicativos e outros transportes"],
    Lazer_Assinaturas: ["Viagens e hospedagem", "Passeios e eventos", "Assinaturas e serviços digitais", "Outros lazeres"],
  },
};

export const CATEGORIA_LABEL: Record<string, string> = {
  PessoalSaude: "Pessoal e Saúde",
  Lazer_Assinaturas: "Lazer e Assinaturas",
  Familia: "Família e Terceiros",
};
export const catLabel = (c?: string | null) => (c ? (CATEGORIA_LABEL[c] ?? c) : "Sem categoria");

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const fmtBRL = (v: number) => brl.format(v || 0);
export const fmtCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesLabel = (iso: string) => {
  const [y = 0, m = 1] = iso.split("-").map(Number);
  return `${MESES[m - 1]}/${String(y).slice(2)}`;
};
export const mesKey = (iso: string) => iso.slice(0, 7);
export const addMonths = (iso: string, n: number) => {
  const [y = 0, m = 1] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

export const isSaida = (m: Pick<Movimento, "movimento">) => m.movimento.toLowerCase().startsWith("sa");
export const isProprio = (m: Pick<Movimento, "responsavel">) =>
  (m.responsavel ?? PROPRIO).toUpperCase() === PROPRIO;

/** Splits a purchase into N monthly installments, labelled "desc i/N". */
export function gerarParcelas(base: NovoMovimento & { mes: string }, total: number, parcelas: number): NovoMovimento[] {
  const n = Math.max(1, Math.floor(parcelas));
  const valor = Math.round((total / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    mes: addMonths(base.mes, i),
    valor: i === n - 1 ? Math.round((total - valor * (n - 1)) * 100) / 100 : valor,
    detalhamento: n > 1 ? `${base.detalhamento ?? ""} ${i + 1}/${n}`.trim() : (base.detalhamento ?? null),
  }));
}

export type Conferencia = { cartao: string; mes: string; registrado: number; fatura: number | null; diferenca: number | null };

/** Card statement check: app total for card+month vs. the statement total typed by the user. */
export function conferirFaturas(movs: Movimento[], faturas: Pick<Fatura, "cartao" | "mes" | "valor">[], cartoes: string[], mes: string): Conferencia[] {
  const key = mesKey(mes);
  return cartoes.map((cartao) => {
    const registrado = movs
      .filter((m) => m.forma_pgto === cartao && mesKey(m.mes) === key && isSaida(m))
      .reduce((s, m) => s + Number(m.valor), 0);
    const f = faturas.find((x) => x.cartao === cartao && mesKey(x.mes) === key);
    const fatura = f ? Number(f.valor) : null;
    return {
      cartao,
      mes,
      registrado: Math.round(registrado * 100) / 100,
      fatura,
      diferenca: fatura === null ? null : Math.round((fatura - registrado) * 100) / 100,
    };
  });
}

export function resumoMes(movs: Movimento[], mes: string | null) {
  const list = mes ? movs.filter((m) => mesKey(m.mes) === mesKey(mes)) : movs;
  let entradas = 0, saidasProprias = 0, terceiros = 0, pago = 0, previsto = 0;
  for (const m of list) {
    const v = Number(m.valor);
    if (!isSaida(m)) entradas += v;
    else if (isProprio(m)) {
      saidasProprias += v;
      if (m.situacao === "Pago") pago += v; else previsto += v;
    } else terceiros += v;
  }
  return { entradas, saidasProprias, terceiros, pago, previsto, saldo: entradas - saidasProprias, count: list.length };
}
