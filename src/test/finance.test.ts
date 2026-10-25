import { describe, expect, it } from "vitest";
import { conferirFaturas, gerarParcelas, resumoMes, type Movimento } from "@/lib/finance";

const mov = (p: Partial<Movimento>): Movimento => ({
  id: crypto.randomUUID(), user_id: null, ordem: 0, mes: "2027-01-01", data_compra: null, movimento: "Saída",
  categoria: null, subcategoria: null, detalhamento: null, forma_pgto: null, responsavel: "RECURSO PROPRIO",
  valor: 0, formula: null, situacao: "Previsto", created_at: "", ...p,
});

describe("finanças", () => {
  it("divide compra parcelada em meses consecutivos somando o total", () => {
    const p = gerarParcelas({ mes: "2027-11-01", movimento: "Saída", detalhamento: "TV" }, 1000, 3);
    expect(p.map((x) => x.mes)).toEqual(["2027-11-01", "2027-12-01", "2028-01-01"]);
    expect(p.map((x) => x.detalhamento)).toEqual(["TV 1/3", "TV 2/3", "TV 3/3"]);
    expect(p.reduce((s, x) => s + Number(x.valor), 0)).toBeCloseTo(1000, 2);
  });

  it("confere a fatura do cartão contra o total registrado no mês", () => {
    const movs = [
      mov({ forma_pgto: "Itau 17", valor: 100 }),
      mov({ forma_pgto: "Itau 17", valor: 50, responsavel: "ELAISA" }),
      mov({ forma_pgto: "Itau 17", valor: 999, mes: "2027-02-01" }),
    ];
    const [c] = conferirFaturas(movs, [{ cartao: "Itau 17", mes: "2027-01-01", valor: 160 }], ["Itau 17"], "2027-01-01");
    expect(c!.registrado).toBe(150);
    expect(c!.diferenca).toBe(10);
  });

  it("saídas de terceiros não entram nas saídas próprias", () => {
    const r = resumoMes([mov({ movimento: "Entrada", valor: 1000 }), mov({ valor: 200 }), mov({ valor: 300, responsavel: "LOURDES" })], null);
    expect(r).toMatchObject({ entradas: 1000, saidasProprias: 200, terceiros: 300, saldo: 800 });
  });
});
