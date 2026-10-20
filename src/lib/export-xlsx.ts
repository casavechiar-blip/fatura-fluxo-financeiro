import JSZip from "jszip";
import modelo from "@/assets/planilha-modelo.xlsx.asset.json";
import type { Movimento } from "./finance";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const serial = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

const str = (ref: string, s: number, v: string | null | undefined) =>
  v == null || v === "" ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;

/**
 * Builds the export from the user's original workbook: only the data rows of
 * "Movimentos" are replaced. Every other sheet, formula, table, pivot and
 * validation stays as in the original file, and Excel recalculates on open.
 */
export async function gerarPlanilha(movs: Movimento[]): Promise<Blob> {
  const buf = await fetch(modelo.url).then((r) => {
    if (!r.ok) throw new Error("Não foi possível carregar a planilha modelo");
    return r.arrayBuffer();
  });
  const zip = await JSZip.loadAsync(buf);
  const sheetPath = "xl/worksheets/sheet2.xml";
  let sheet = await zip.file(sheetPath)!.async("string");

  const rows = [...movs].sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  const last = Math.max(rows.length + 1, 2);
  const header = sheet.match(/<row r="1"[\s\S]*?<\/row>/)![0];
  const body = rows
    .map((m, i) => {
      const r = i + 2;
      const v = Number(m.valor);
      const h = m.formula
        ? `<c r="H${r}" s="15"><f>${esc(m.formula.replace(/^=/, ""))}</f><v>${v}</v></c>`
        : `<c r="H${r}" s="15"><v>${v}</v></c>`;
      return (
        `<row r="${r}" spans="1:9">` +
        `<c r="A${r}" s="8"><v>${serial(m.mes)}</v></c>` +
        str(`B${r}`, 4, m.movimento) +
        str(`C${r}`, 4, m.categoria) +
        str(`D${r}`, 4, m.subcategoria) +
        str(`E${r}`, 4, m.detalhamento) +
        str(`F${r}`, 4, m.forma_pgto) +
        str(`G${r}`, 4, m.responsavel) +
        h +
        str(`I${r}`, 5, m.situacao) +
        `</row>`
      );
    })
    .join("");

  sheet = sheet
    .replace(/<sheetData>[\s\S]*<\/sheetData>/, `<sheetData>${header}${body}</sheetData>`)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:I${last}"/>`)
    .replace(/sqref="([^"]*)"/g, (_, refs: string) =>
      `sqref="${refs.replace(/([A-I])2:\1(\d+)/g, (__, col: string, end: string) => `${col}2:${col}${Math.max(Number(end), last)}`)}"`,
    );
  zip.file(sheetPath, sheet);

  const tablePath = "xl/tables/table1.xml";
  const table = await zip.file(tablePath)!.async("string");
  zip.file(tablePath, table.replace(/ref="A1:I\d+"/g, `ref="A1:I${last}"`));

  // Force Excel to recalculate formulas and refresh the pivot tables on open.
  zip.remove("xl/calcChain.xml");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  zip.file("xl/_rels/workbook.xml.rels", rels.replace(/<Relationship [^>]*Target="calcChain\.xml"\/>/, ""));
  const ct = await zip.file("[Content_Types].xml")!.async("string");
  zip.file("[Content_Types].xml", ct.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ""));
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  zip.file("xl/workbook.xml", wb.replace(/<calcPr([^>]*?)\/>/, (_, a: string) => `<calcPr${a.replace(/ fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`));
  const pcPath = "xl/pivotCache/pivotCacheDefinition1.xml";
  const pc = zip.file(pcPath);
  if (pc) {
    const x = await pc.async("string");
    zip.file(pcPath, x.includes("refreshOnLoad") ? x : x.replace("<pivotCacheDefinition ", '<pivotCacheDefinition refreshOnLoad="1" '));
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
