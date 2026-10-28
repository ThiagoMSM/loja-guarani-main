import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export function exportarPDF({ titulo, filtrosTexto, colunas, linhas, nomeArquivo }) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(13);
  doc.text("LOJA GUARANI - LOJA DO TURQUINHO (HACIB CAMASMIE & CIA LTDA)", 14, 14);

  doc.setFontSize(9);
  doc.text("CNPJ: 60.716.586/0001-17 | Rua Tres Rios, 148 - Bom Retiro, Sao Paulo/SP", 14, 20);
  doc.text(
    `${titulo} | Gerado em: ${new Date().toLocaleString("pt-BR")} | Filtros: ${filtrosTexto || "Todos"}`,
    14,
    26
  );

  autoTable(doc, {
    startY: 31,
    head: [colunas],
    body: linhas,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] }
  });

  doc.save(`${nomeArquivo}.pdf`);
}

export function exportarExcel({ titulo, filtrosTexto, colunas, linhas, nomeArquivo }) {
  const cabecalhoInstitucional = [
    ["LOJA GUARANI - LOJA DO TURQUINHO (HACIB CAMASMIE & CIA LTDA)"],
    ["CNPJ: 60.716.586/0001-17 | Rua Tres Rios, 148 - Bom Retiro, Sao Paulo/SP"],
    [`${titulo} | Gerado em: ${new Date().toLocaleString("pt-BR")} | Filtros: ${filtrosTexto || "Todos"}`],
    [],
    colunas,
    ...linhas
  ];

  const ws = XLSX.utils.aoa_to_sheet(cabecalhoInstitucional);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
}
