import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData } from "../utils/formatters";
import { exportarPDF, exportarExcel } from "../utils/exporters";
import { Badge } from "../components/Badge";
import { TooltipInfo } from "../components/TooltipInfo";
import {
  Calendar,
  AlertTriangle,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  ArrowRight,
  ShieldAlert,
  DollarSign,
  Package,
  RotateCcw,
  CheckCircle2,
  CalendarDays
} from "lucide-react";

export function RelatorioValidadePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({ valorTotalEmRisco: 0, totalLotesMonitorados: 0, lotes: [] });
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);

  // Filtros
  const [janela, setJanela] = useState("30"); // "VENCIDOS", "30", "60", "90", "PERSONALIZADO"
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [idCateg, setIdCateg] = useState("");
  const [idFornec, setIdFornec] = useState("");

  useEffect(() => {
    carregarFiltrosAuxiliares();
  }, []);

  useEffect(() => {
    carregarRelatorio();
  }, [janela, idCateg, idFornec]);

  const carregarFiltrosAuxiliares = async () => {
    try {
      const [catsRes, fornsRes] = await Promise.all([
        api.get("/categorias"),
        api.get("/fornecedores")
      ]);
      setCategorias(catsRes || []);
      setFornecedores(fornsRes || []);
    } catch (err) {
      addToast(err.message || "Erro ao carregar dados auxiliares.", "error");
    }
  };

  const carregarRelatorio = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("janela", janela);
      if (janela === "PERSONALIZADO") {
        if (dataInicio) params.append("dataInicio", dataInicio);
        if (dataFim) params.append("dataFim", dataFim);
      }
      if (idCateg) params.append("idCateg", idCateg);
      if (idFornec) params.append("idFornec", idFornec);

      const res = await api.get(`/relatorios/validade?${params.toString()}`);
      setDados(res || { valorTotalEmRisco: 0, totalLotesMonitorados: 0, lotes: [] });
    } catch (err) {
      addToast(err.message || "Erro ao carregar relatório de validade.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAplicarPersonalizado = (e) => {
    e.preventDefault();
    if (!dataInicio || !dataFim) {
      addToast("Selecione data de início e término para o período personalizado.", "warning");
      return;
    }
    carregarRelatorio();
  };

  const handleLimparFiltros = () => {
    setJanela("30");
    setDataInicio("");
    setDataFim("");
    setIdCateg("");
    setIdFornec("");
  };

  // Contadores semânticos
  const qtdVencidos = dados.lotes.filter((l) => l.criticidade === "VENCIDO" || l.diasRestantes <= 0).length;
  const qtdCriticos30d = dados.lotes.filter((l) => l.criticidade === "CRITICO_30D" && l.diasRestantes > 0).length;
  const qtdAtencao = dados.lotes.filter((l) => l.criticidade === "ATENCAO" && l.diasRestantes > 30).length;

  const colunasExport = [
    "SKU",
    "Produto",
    "Lote",
    "Categoria",
    "Fornecedor",
    "Localização",
    "Data Compra",
    "Validade",
    "Dias Restantes",
    "Qtd em Risco",
    "Custo Unit (R$)",
    "Total em Risco (R$)",
    "Criticidade"
  ];

  const linhasExport = dados.lotes.map((l) => [
    l.sku,
    l.nomeProduto,
    l.numLote,
    l.categoriaNome,
    l.fornecedorNome,
    l.locaisFisicos,
    formatarData(l.dataCompra),
    formatarData(l.dataValidade),
    l.diasRestantes <= 0 ? `Vencido (${Math.abs(l.diasRestantes)}d atrás)` : `${l.diasRestantes} dias`,
    `${l.quantidadeAtual} ${l.unidMedida}`,
    l.valorCompraUnit.toFixed(2),
    l.valorTotalEmRisco.toFixed(2),
    l.criticidade
  ]);

  const handleExportarPdf = () => {
    exportarPDF({
      titulo: "RELATÓRIO DE CONTROLE DE VALIDADE (FEFO)",
      filtrosTexto: `Janela: ${janela} | Categoria: ${idCateg || "Todas"} | Fornecedor: ${idFornec || "Todos"} | Total em Risco: ${formatarMoeda(dados.valorTotalEmRisco)}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: `Relatorio_Validade_Loja_Guarani_${janela}`
    });
  };

  const handleExportarExcel = () => {
    exportarExcel({
      titulo: "RELATÓRIO DE CONTROLE DE VALIDADE (FEFO)",
      filtrosTexto: `Janela: ${janela} | Categoria: ${idCateg || "Todas"} | Fornecedor: ${idFornec || "Todos"} | Total em Risco: ${formatarMoeda(dados.valorTotalEmRisco)}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: `Relatorio_Validade_Loja_Guarani_${janela}`
    });
  };

  const handleAtalhoBaixa = (lote) => {
    // Redireciona para Ajuste Manual preenchendo os parâmetros
    navigate(`/ajuste-estoque?idProd=${lote.idProd}&idLote=${lote.idLote}&tipo=BAIXA&justificativa=VENCIMENTO`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Título & Ações Superiores */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--color-navy)" }}>
              Controle de Validade (FEFO)
            </h1>
            <TooltipInfo texto="Monitoramento preventivo de lotes perecíveis (First-Expired, First-Out). Evita perdas financeiras por expiração de colas, tintas e vernizes têxteis." />
          </div>
          <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "4px" }}>
            Visualize os lotes próximos ao vencimento, o impacto financeiro em risco e providencie a baixa manual de avarias.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleExportarPdf}
            disabled={dados.lotes.length === 0}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={16} /> Exportar PDF
          </button>
          <button
            onClick={handleExportarExcel}
            disabled={dados.lotes.length === 0}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Cards de Resumo e Risco Financeiro */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px"
        }}
      >
        {/* Card Valor em Risco */}
        <div
          className="card"
          style={{
            borderLeft: "4px solid #EF4444",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              background: "#FEE2E2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: "600" }}>
              VALOR TOTAL EM RISCO
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: "700", color: "#DC2626" }}>
              {formatarMoeda(dados.valorTotalEmRisco)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Custo de aquisição monitorado
            </div>
          </div>
        </div>

        {/* Card Vencidos */}
        <div
          className="card"
          style={{
            borderLeft: "4px solid #DC2626",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              background: "#FEE2E2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ShieldAlert size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: "600" }}>
              LOTES JÁ VENCIDOS
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: "700", color: "#B91C1C" }}>
              {qtdVencidos} {qtdVencidos === 1 ? "lote" : "lotes"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: "500" }}>
              Requer descarte / baixa imediata
            </div>
          </div>
        </div>

        {/* Card Críticos (<= 30 dias) */}
        <div
          className="card"
          style={{
            borderLeft: "4px solid #F59E0B",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              background: "#FEF3C7",
              color: "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: "600" }}>
              VENCENDO EM ATÉ 30 DIAS
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: "700", color: "#D97706" }}>
              {qtdCriticos30d} {qtdCriticos30d === 1 ? "lote" : "lotes"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#B45309" }}>
              Priorizar venda na frente de caixa
            </div>
          </div>
        </div>

        {/* Card Monitorados */}
        <div
          className="card"
          style={{
            borderLeft: "4px solid #3B82F6",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px 20px"
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              background: "#DBEAFE",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: "600" }}>
              TOTAL DE LOTES NA JANELA
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: "700", color: "#1E293B" }}>
              {dados.totalLotesMonitorados}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
              {qtdAtencao} lotes em atenção (31 a 90d)
            </div>
          </div>
        </div>
      </div>

      {/* Controles e Filtros */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Controle Segmentado de Janela de Tempo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={18} color="#64748B" />
            <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#334155" }}>
              Janela Temporal de Vencimento:
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              background: "#F1F5F9",
              padding: "4px",
              borderRadius: "8px",
              gap: "4px"
            }}
          >
            {[
              { id: "VENCIDOS", label: "Já Vencidos", icon: AlertTriangle, color: "#DC2626" },
              { id: "30", label: "Próx. 30 dias", icon: Clock, color: "#D97706" },
              { id: "60", label: "Próx. 60 dias", icon: CalendarDays, color: "#2563EB" },
              { id: "90", label: "Próx. 90 dias", icon: CalendarDays, color: "#475569" },
              { id: "PERSONALIZADO", label: "Personalizado", icon: Calendar, color: "#1E293B" }
            ].map((tab) => {
              const ativo = janela === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setJanela(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: ativo ? "600" : "500",
                    border: "none",
                    cursor: "pointer",
                    background: ativo ? "#FFFFFF" : "transparent",
                    color: ativo ? tab.color || "var(--color-navy)" : "#64748B",
                    boxShadow: ativo ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros Auxiliares (Categoria, Fornecedor e Datas quando Personalizado) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              janela === "PERSONALIZADO"
                ? "repeat(auto-fit, minmax(200px, 1fr))"
                : "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            alignItems: "end",
            paddingTop: "12px",
            borderTop: "1px solid #E2E8F0"
          }}
        >
          {janela === "PERSONALIZADO" && (
            <>
              <div>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>
                  Data Início
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>
                  Data Término
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleAplicarPersonalizado}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "8px 12px", fontSize: "0.8125rem" }}
                >
                  Aplicar Período
                </button>
              </div>
            </>
          )}

          <div>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>
              Filtrar por Categoria
            </label>
            <select
              className="form-control"
              value={idCateg}
              onChange={(e) => setIdCateg(e.target.value)}
            >
              <option value="">Todas as Categorias</option>
              {categorias.map((c) => (
                <option key={c.idCateg} value={c.idCateg}>
                  {c.codigoHierarquico ? `${c.codigoHierarquico} - ` : ""}
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: "0.75rem" }}>
              Filtrar por Fornecedor
            </label>
            <select
              className="form-control"
              value={idFornec}
              onChange={(e) => setIdFornec(e.target.value)}
            >
              <option value="">Todos os Fornecedores</option>
              {fornecedores.map((f) => (
                <option key={f.idFornec} value={f.idFornec}>
                  {f.razSocial} ({f.nomeFantasia || f.cnpj})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleLimparFiltros}
              className="btn btn-secondary"
              style={{ padding: "8px 12px", fontSize: "0.8125rem" }}
              title="Limpar todos os filtros"
            >
              <RotateCcw size={14} /> Limpar
            </button>
            <button
              onClick={carregarRelatorio}
              className="btn btn-secondary"
              style={{ padding: "8px 12px", fontSize: "0.8125rem" }}
              title="Recarregar dados"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Lotes com Detalhes FEFO */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span style={{ fontWeight: "600", color: "var(--color-navy)" }}>
            Lotes Encontrados ({dados.lotes.length})
          </span>
          <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>
            Ordenação cronológica estrita por validade (FEFO)
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto / Categoria</th>
                <th>Lote</th>
                <th>Fornecedor</th>
                <th>Localização</th>
                <th>Data Validade</th>
                <th>Dias Restantes</th>
                <th style={{ textAlign: "right" }}>Saldo Lote</th>
                <th style={{ textAlign: "right" }}>Custo Unit.</th>
                <th style={{ textAlign: "right" }}>Total em Risco</th>
                <th style={{ textAlign: "center" }}>Criticidade</th>
                <th style={{ textAlign: "center" }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                    Carregando dados de validade...
                  </td>
                </tr>
              ) : dados.lotes.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <CheckCircle2 size={32} color="#10B981" />
                      <div style={{ fontWeight: "600", color: "#1E293B" }}>
                        Nenhum lote crítico encontrado
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
                        Não há lotes com vencimento dentro da janela de filtro selecionada.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                dados.lotes.map((l) => {
                  const isVencido = l.criticidade === "VENCIDO" || l.diasRestantes <= 0;
                  const isCritico30 = l.criticidade === "CRITICO_30D" && l.diasRestantes > 0;
                  const isAtencao = l.criticidade === "ATENCAO" && l.diasRestantes > 30;

                  return (
                    <tr
                      key={l.idLote}
                      style={{
                        background: isVencido
                          ? "rgba(254, 242, 242, 0.4)"
                          : isCritico30
                          ? "rgba(254, 243, 199, 0.25)"
                          : undefined
                      }}
                    >
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: "600" }}>
                        {l.sku}
                      </td>
                      <td>
                        <div style={{ fontWeight: "600", color: "var(--color-navy)" }}>
                          {l.nomeProduto}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          {l.categoriaNome}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            background: "#F1F5F9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.8125rem"
                          }}
                        >
                          {l.numLote}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "#475569" }}>
                        {l.fornecedorNome}
                      </td>
                      <td style={{ fontSize: "0.8125rem" }}>
                        {l.locaisFisicos}
                      </td>
                      <td style={{ fontWeight: "600", color: isVencido ? "#DC2626" : "#1E293B" }}>
                        {formatarData(l.dataValidade)}
                      </td>
                      <td>
                        {isVencido ? (
                          <span style={{ color: "#DC2626", fontWeight: "700", fontSize: "0.8125rem" }}>
                            Vencido há {Math.abs(l.diasRestantes)} {Math.abs(l.diasRestantes) === 1 ? "dia" : "dias"}
                          </span>
                        ) : isCritico30 ? (
                          <span style={{ color: "#D97706", fontWeight: "600", fontSize: "0.8125rem" }}>
                            Faltam {l.diasRestantes} {l.diasRestantes === 1 ? "dia" : "dias"}
                          </span>
                        ) : (
                          <span style={{ color: "#475569", fontSize: "0.8125rem" }}>
                            Faltam {l.diasRestantes} dias
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "600" }}>
                        {l.quantidadeAtual} {l.unidMedida}
                      </td>
                      <td style={{ textAlign: "right", color: "#64748B", fontSize: "0.8125rem" }}>
                        {formatarMoeda(l.valorCompraUnit)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: "700",
                          color: isVencido ? "#DC2626" : isCritico30 ? "#D97706" : "#1E293B"
                        }}
                      >
                        {formatarMoeda(l.valorTotalEmRisco)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isVencido ? (
                          <Badge tipo="perigo">VENCIDO</Badge>
                        ) : isCritico30 ? (
                          <Badge tipo="alerta">CRÍTICO ≤ 30D</Badge>
                        ) : isAtencao ? (
                          <Badge tipo="info">ATENÇÃO 31-90D</Badge>
                        ) : (
                          <Badge tipo="sucesso">NORMAL &gt; 90D</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isVencido ? (
                          <button
                            onClick={() => handleAtalhoBaixa(l)}
                            className="btn btn-danger"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title="Registrar baixa por vencimento no estoque manual"
                          >
                            Baixar Vencido <ArrowRight size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAtalhoBaixa(l)}
                            className="btn btn-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title="Ajustar saldo deste lote manualmente"
                          >
                            Ajustar <ArrowRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default RelatorioValidadePage;
