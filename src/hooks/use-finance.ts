import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cartao, Fatura, Movimento, NovoMovimento } from "@/lib/finance";

let claimed = false;
async function ensureClaimed() {
  if (claimed) return;
  claimed = true;
  await supabase.rpc("claim_seed_data");
}

export const movimentosQuery = queryOptions({
  queryKey: ["movimentos"],
  queryFn: async (): Promise<Movimento[]> => {
    await ensureClaimed();
    const all: Movimento[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("movimentos").select("*").order("ordem").range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return all;
  },
});

export const cartoesQuery = queryOptions({
  queryKey: ["cartoes"],
  queryFn: async (): Promise<Cartao[]> => {
    await ensureClaimed();
    const { data, error } = await supabase.from("cartoes").select("*").order("vencimento");
    if (error) throw error;
    return data;
  },
});

export const faturasQuery = queryOptions({
  queryKey: ["faturas"],
  queryFn: async (): Promise<Fatura[]> => {
    const { data, error } = await supabase.from("faturas").select("*");
    if (error) throw error;
    return data;
  },
});

export const useMovimentos = () => useQuery(movimentosQuery);
export const useCartoes = () => useQuery(cartoesQuery);
export const useFaturas = () => useQuery(faturasQuery);

export function useSalvarMovimentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: NovoMovimento[]) => {
      const { data: max } = await supabase.from("movimentos").select("ordem").order("ordem", { ascending: false }).limit(1);
      let ordem = (max?.[0]?.ordem ?? 0) + 1;
      const { error } = await supabase.from("movimentos").insert(rows.map((r) => ({ ...r, ordem: r.ordem ?? ordem++ })));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentos"] }),
  });
}

export function useAtualizarMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Movimento> & { id: string }) => {
      const { error } = await supabase.from("movimentos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentos"] }),
  });
}

export function useExcluirMovimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentos"] }),
  });
}

export function useSalvarCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Cartao> & { nome: string; vencimento: number }) => {
      const { error } = c.id
        ? await supabase.from("cartoes").update(c).eq("id", c.id)
        : await supabase.from("cartoes").insert(c);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartoes"] }),
  });
}

export function useExcluirCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartoes"] }),
  });
}

export function useSalvarFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { cartao: string; mes: string; valor: number; user_id: string }) => {
      const { error } = await supabase.from("faturas").upsert(f, { onConflict: "user_id,cartao,mes" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faturas"] }),
  });
}
