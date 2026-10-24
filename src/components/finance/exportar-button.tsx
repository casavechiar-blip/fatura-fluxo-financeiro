import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMovimentos } from "@/hooks/use-finance";
import { baixarArquivo, gerarPlanilha } from "@/lib/export-xlsx";

export function ExportarButton() {
  const { data } = useMovimentos();
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState<Blob | null>(null);
  const nome = `Gastos_Revisado_${new Date().toISOString().slice(0, 10)}.xlsx`;

  if (pronto)
    return (
      <Button variant="secondary" onClick={() => { baixarArquivo(pronto, nome); setPronto(null); }}>
        <Download className="size-4" /> Baixar .xlsx
      </Button>
    );

  return (
    <Button
      variant="outline"
      disabled={!data || busy}
      onClick={async () => {
        setBusy(true);
        try {
          setPronto(await gerarPlanilha(data!));
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      <span className="hidden sm:inline">Gerar Excel</span>
    </Button>
  );
}
