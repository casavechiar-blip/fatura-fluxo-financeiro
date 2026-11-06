import { useState, useEffect } from "react";

export interface BudgetConfig {
  id: string;
  categoria: string;
  subcategoria: string;
  valorMensal: number;
}

const STORAGE_KEY = "financas_budgets_config";

const DEFAULT_BUDGETS: BudgetConfig[] = [
  {
    id: "default-alimentacao-mercado",
    categoria: "Alimentação",
    subcategoria: "Mercado",
    valorMensal: 2000,
  },
];

function carregarBudgets(): BudgetConfig[] {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_BUDGETS;
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<BudgetConfig[]>(carregarBudgets);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
    } catch {
      // ignore
    }
  }, [budgets]);

  const salvarBudget = (novo: Omit<BudgetConfig, "id"> & { id?: string }) => {
    setBudgets((prev) => {
      if (novo.id) {
        return prev.map((b) => (b.id === novo.id ? { ...b, ...novo, id: b.id } : b));
      }
      // Verificar se já existe combinação de categoria e subcategoria
      const existente = prev.find(
        (b) => b.categoria === novo.categoria && b.subcategoria === novo.subcategoria
      );
      if (existente) {
        return prev.map((b) => (b.id === existente.id ? { ...b, valorMensal: novo.valorMensal } : b));
      }
      return [...prev, { ...novo, id: `budget-${Date.now()}` }];
    });
  };

  const excluirBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  return {
    budgets,
    salvarBudget,
    excluirBudget,
  };
}
