import type { LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mesLabel } from "@/lib/finance";

export function Kpi({ label, value, icon: Icon, tone = "primary", hint }: { label: string; value: string; icon: LucideIcon; tone?: "primary" | "income" | "expense" | "chart-3"; hint?: string }) {
  const toneCls = { primary: "text-primary bg-primary/10", income: "text-income bg-income/10", expense: "text-expense bg-expense/10", "chart-3": "text-chart-3 bg-chart-3/10" }[tone];
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={`rounded-lg p-2 ${toneCls}`}><Icon className="size-4" /></span>
      </div>
      <p className="font-display mt-3 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ title, children, className = "", action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MesSelect({ meses, value, onChange, todos = true }: { meses: string[]; value: string; onChange: (v: string) => void; todos?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
      <SelectContent>
        {todos && <SelectItem value="todos">Ano inteiro</SelectItem>}
        {meses.map((m) => <SelectItem key={m} value={m}>{mesLabel(m)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];
