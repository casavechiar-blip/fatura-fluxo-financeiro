import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, CreditCard, LayoutDashboard, ListOrdered, LogOut, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NovoLancamentoButton } from "@/components/finance/novo-lancamento";
import { ExportarButton } from "@/components/finance/exportar-button";
import { FilterProvider } from "@/hooks/use-global-filters";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ListOrdered },
  { to: "/cartoes", label: "Cartões e faturas", icon: CreditCard },
  { to: "/fluxo-de-caixa", label: "Fluxo de caixa", icon: ArrowLeftRight },
] as const;

function Shell() {
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="bg-gold flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="font-display text-lg font-semibold">Finanças</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-primary font-semibold" }}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <Button
          variant="ghost"
          className="justify-start text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            nav({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" /> Sair
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <nav className="flex gap-1 md:hidden">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md p-2 text-muted-foreground" activeProps={{ className: "text-primary" }}>
                <n.icon className="size-5" />
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex gap-2">
            <ExportarButton />
            <NovoLancamentoButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">
          <FilterProvider>
            <Outlet />
          </FilterProvider>
        </main>
      </div>
    </div>
  );
}
