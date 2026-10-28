import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData } from "../utils/formatters";
import { exportarPDF, exportarExcel } from "../utils/exporters";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import {
  Search,
  Filter,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Eye,
  Boxes,
  MapPin,
  Calendar
} from "lucide-react";

export function ConsultaEstoquePage() {
  const { alertaErro } = useToast();

  const [itens, setItens] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Filtros Combinados
  const [busca, setBusca] = useState("");
  const [idCateg, setIdCateg] = useState("");
  const [idLocal, setIdLocal] = useState("");
  const [situacao, setSituacao] = useState("TODOS");

  // Modal de Detalhes dos Lotes (Fluxo A2)
  const [modalLoteOpen, setModalLoteOpen] = useState(false);
  const [produtoInspecionado, setProdutoInspecionado] = useState(null);

  const carregarFiltrosIniciais = async () => {
    try {
      const [resCat, resLoc] = await Promise.all([
        api.get("/categorias"),
        api.get("/locais?status=ATIVO")
      ]);
      setCategorias(resCat);
      setLocais(resLoc);
    } catch {
      // Ignorar falha em listas de filtro
    }
  };

  const executarConsulta = async () => {
    try {
      setCarregando(true);
      const params = new URLSearchParams();
      if (busca.trim()) params.append("busca", busca.trim());
      if (idCateg) params.append("idCateg", idCateg);
      if (idLocal) params.append("idLocal", idLocal);
      if (situacao && situacao !== "TODOS") params.append("situacao", situacao);

      const res = await api.get(`/relatorios/posicao-estoque?${params.toString()}`);
      setItens(res);
    } catch (err) {
      alertaErro(err.message || "Erro ao consultar posição de estoque.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarFiltrosIniciais();
    executarConsulta();
  }, []);

  const handleLimparFiltros = () => {
    setBusca("");
    setIdCateg("");
    setIdLocal("");
    setSituacao("TODOS");
    api.get("/relatorios/posicao-estoque").then(setItens).catch(() => {});
  };

  const abrirModalLotes = (item) => {
    setProdutoInspecionado(item);
    setModalLoteOpen(true);
  };

  // Exportação PDF / Excel
  const colunasExport = [
    "SKU",
    "Aviamento / Produto",
    "Categoria",
    "Unid",
    "Locais Físicos",
    "Estoque Total",
    "Reservado",
    "Saldo Livre",
    "Mínimo",
    "Situação"
  ];

  const linhasExport = itens.map((it) => [
    it.sku,
    it.nome,
    it.categoriaNome,
    it.unidMedida,
    it.locaisFisicos,
    it.estoqueTotal,
    it.estoqueReservado,
    it.saldoLivre,
    it.estoqueMin,
    it.situacao
  ]);

  const handleExportarPdf = () => {
    exportarPDF({
      titulo: "POSIÇÃO CONSOLIDADA DE ESTOQUE EM TEMPO REAL",
      filtrosTexto: `Busca: ${busca || "Nenhuma"} | Categoria: ${idCateg || "Todas"} | Local: ${idLocal || "Todos"} | Situação: ${situacao}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: "Posicao_Estoque_Loja_Guarani"
    });
  };

  const handleExportarExcel = () => {
    exportarExcel({
      titulo: "POSIÇÃO CONSOLIDADA DE ESTOQUE EM TEMPO REAL",
      filtrosTexto: `Busca: ${busca || "Nenhuma"} | Categoria: ${idCateg || "Todas"} | Local: ${idLocal || "Todos"} | Situação: ${situacao}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: "Posicao_Estoque_Loja_Guarani"
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Consulta de Posição de Estoque em Tempo Real</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Filtros combinados por aviamento, gaveteiro e saldo com tempo de resposta imediato (&lt; 3s).
        </p>
      </div>

      {/* Painel de Filtros Combinados */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executarConsulta();
          }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "flex-end" }}
        >
          <label>
            <span>Buscar (SKU, EAN ou Nome)</span>
            <div style={{ position: "relative" }}>
              <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "12px" }} />
              <input
                type="text"
                placeholder="Ex: 1001, Linha Branca..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: "32px" }}
              />
            </div>
          </label>

          <label>
            <span>Categoria</span>
            <select value={idCateg} onChange={(e) => setIdCateg(e.target.value)}>
              <option value="">Todas as Categorias</option>
              {categorias.map((c) => (
                <option key={c.idCateg} value={c.idCateg}>
                  {c.codigoHierarquico ? `[${c.codigoHierarquico}] ` : ""}{c.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Local Físico / Gaveteiro</span>
            <select value={idLocal} onChange={(e) => setIdLocal(e.target.value)}>
              <option value="">Todos os Locais</option>
              {locais.map((l) => (
                <option key={l.idLocal} value={l.idLocal}>
                  {l.codigo} — {l.descricao}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Situação do Saldo</span>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value="TODOS">Todas as Situações</option>
              <option value="DISPONIVEL">Disponível em Estoque</option>
              <option value="RESERVADO">Com Reserva Ativa no Balcão</option>
              <option value="ABAIXO_MINIMO">Abaixo do Estoque Mínimo</option>
              <option value="EM_FALTA">Zerado / Em Falta</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Filter size={15} />
              <span>Filtrar</span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleLimparFiltros} title="Limpar Filtros">
              <RotateCcw size={15} />
            </button>
          </div>
        </form>
      </div>

      {/* Grade de Dados com Exportação */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <h2>Resultados da Posição de Estoque ({itens.length})</h2>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportarPdf}
              disabled={itens.length === 0}
              title="Exportar Listagem para PDF"
            >
              <Download size={14} />
              <span>Exportar PDF</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportarExcel}
              disabled={itens.length === 0}
              title="Exportar Listagem para Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {itens.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#F8FAFC", borderRadius: "6px" }}>
            <p style={{ color: "#334155", fontWeight: "600", fontSize: "15px", marginBottom: "6px" }}>
              Nenhum item localizado com os filtros informados. Verifique os critérios de busca
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleLimparFiltros} style={{ marginTop: "8px" }}>
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Aviamento / Produto</th>
                  <th>Categoria</th>
                  <th>Gaveteiro(s)</th>
                  <th>Estoque Total</th>
                  <th>Reservado</th>
                  <th>Saldo Livre</th>
                  <th>Estoque Mínimo</th>
                  <th>Situação</th>
                  <th style={{ textAlign: "center" }}>Lotes (A2)</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => {
                  let sitVariant = "success";
                  if (it.situacao === "EM_FALTA") sitVariant = "danger";
                  else if (it.situacao === "ABAIXO_MINIMO") sitVariant = "warning";
                  else if (it.situacao === "RESERVADO") sitVariant = "info";

                  return (
                    <tr
                      key={it.idProd}
                      onClick={() => abrirModalLotes(it)}
                      style={{ cursor: "pointer" }}
                      title="Clique para ver detalhamento dos lotes e gaveteiros (Fluxo A2)"
                    >
                      <td className="mono" style={{ fontWeight: "700", color: "#1D4ED8" }}>
                        {it.sku}
                      </td>
                      <td>
                        <strong>{it.nome}</strong>
                      </td>
                      <td>{it.categoriaNome}</td>
                      <td className="mono" style={{ fontSize: "12px", color: "#475569" }}>
                        {it.locaisFisicos}
                      </td>
                      <td className="mono" style={{ fontWeight: "600" }}>
                        {it.estoqueTotal} {it.unidMedida}
                      </td>
                      <td className="mono" style={{ color: it.estoqueReservado > 0 ? "#0284C7" : "#94A3B8" }}>
                        {it.estoqueReservado} {it.unidMedida}
                      </td>
                      <td className="mono" style={{ fontWeight: "700", color: it.saldoLivre > 0 ? "#166534" : "#DC2626" }}>
                        {it.saldoLivre} {it.unidMedida}
                      </td>
                      <td className="mono" style={{ color: "#64748B" }}>
                        {it.estoqueMin} {it.unidMedida}
                      </td>
                      <td>
                        <Badge variant={sitVariant}>{it.situacao.replace("_", " ")}</Badge>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ height: "28px", padding: "0 8px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalLotes(it);
                          }}
                        >
                          <Eye size={13} />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhamento de Lotes */}
      <Modal
        isOpen={modalLoteOpen}
        onClose={() => setModalLoteOpen(false)}
        title={`Detalhamento de Lotes — ${produtoInspecionado?.nome || ""}`}
        maxWidth="720px"
      >
        {produtoInspecionado && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px 16px", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <span className="mono" style={{ color: "#1D4ED8", fontWeight: "700" }}>
                  SKU {produtoInspecionado.sku}
                </span>
                <div style={{ fontSize: "14px", fontWeight: "600" }}>{produtoInspecionado.nome}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "12px", color: "#64748B" }}>Saldo Total Consolidado:</span>
                <div className="mono" style={{ fontSize: "16px", fontWeight: "700", color: "#166534" }}>
                  {produtoInspecionado.estoqueTotal} {produtoInspecionado.unidMedida}
                </div>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Data Compra</th>
                    <th>Validade</th>
                    <th>Custo Unit.</th>
                    <th>Gaveteiro(s)</th>
                    <th>Saldo Lote</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {produtoInspecionado.lotesDetalhados.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#64748B" }}>
                        Nenhum lote ativo registrado para este produto.
                      </td>
                    </tr>
                  ) : (
                    produtoInspecionado.lotesDetalhados.map((l) => (
                      <tr key={l.idLote}>
                        <td className="mono" style={{ fontWeight: "700" }}>{l.numLote}</td>
                        <td className="mono">{formatarData(l.dataCompra)}</td>
                        <td className="mono">{formatarData(l.dataValidade)}</td>
                        <td className="mono">{formatarMoeda(l.valorCompra)}</td>
                        <td className="mono" style={{ fontSize: "12px" }}>
                          {l.locais.map((loc) => `${loc.codigo} (${loc.quantidade})`).join(", ") || "-"}
                        </td>
                        <td className="mono" style={{ fontWeight: "700" }}>
                          {l.quantidadeAtual} {produtoInspecionado.unidMedida}
                        </td>
                        <td>
                          <Badge variant={l.status === "DISPONIVEL" ? "success" : l.status === "VENCIDO" ? "danger" : "neutral"}>
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
