import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Painel Financeiro" },
      { name: "description", content: "Finanças pessoais com dashboards, cartões e conferência de faturas." },
      { property: "og:title", content: "Painel Financeiro" },
      { property: "og:description", content: "Finanças pessoais com dashboards, cartões e conferência de faturas." },
    ],
  }),
});
