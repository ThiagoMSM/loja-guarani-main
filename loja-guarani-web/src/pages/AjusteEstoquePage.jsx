import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData, formatarDataHora } from "../utils/formatters";
import { exportarPDF, exportarExcel } from "../utils/exporters";
import { Badge } from "../components/Badge";
import { ConfirmModal } from "../components/ConfirmModal";
import { TooltipInfo } from "../components/TooltipInfo";
import {
  SlidersHorizontal,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Filter,
  RotateCcw,
  ShieldCheck,
  Package
} from "lucide-react";

export function AjusteEstoquePage() {
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dados auxiliares para o formulário
  const [produtos, setProdutos] = useState([]);
  const [lotesDisponiveis, setLotesDisponiveis] = useState([]);
  const [locaisDisponiveis, setLocaisDisponiveis] = useState([]);

  // Estado do Formulário
  const [form, setForm] = useState({
    idProd: "",
    idLote: "",
    idLocal: "",
    tipo: "BAIXA", // "BAIXA" ou "ENTRADA"
    quantidade: "",
    justificativa: "VENCIMENTO", // "QUEBRA", "VENCIMENTO", "ROUBO", "INVENTARIO"
    observacao: ""
  });

  // Modal de confirmação
  const [confirmModalAberto, setConfirmModalAberto] = useState(false);

  // Histórico de Movimentações (Trilha de Auditoria)
  const [historico, setHistorico] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroJustificativa, setFiltroJustificativa] = useState("");
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Carregar produtos e histórico ao inicializar
  useEffect(() => {
    carregarProdutos();
    carregarHistorico();
  }, []);

  // Tratar searchParams caso venha de um atalho externo (ex: Relatório de Validade)
  useEffect(() => {
    const paramProd = searchParams.get("idProd");
    const paramLote = searchParams.get("idLote");
    const paramLocal = searchParams.get("idLocal");
    const paramTipo = searchParams.get("tipo");
    const paramJustificativa = searchParams.get("justificativa");

    if (paramProd) {
      setForm((prev) => ({
        ...prev,
        idProd: paramProd,
        tipo: paramTipo || prev.tipo,
        justificativa: paramJustificativa || prev.justificativa
      }));

      // Buscar lotes deste produto para pré-selecionar
      api.get(`/produtos/${paramProd}`).then((prod) => {
        if (prod && prod.lotes) {
          setLotesDisponiveis(prod.lotes);
          if (paramLote) {
            const loteEncontrado = prod.lotes.find((l) => String(l.idLote) === String(paramLote));
            if (loteEncontrado) {
              setForm((prev) => ({ ...prev, idLote: String(paramLote) }));
              const locais = loteEncontrado.locais || [];
              setLocaisDisponiveis(locais);
              if (paramLocal) {
                setForm((prev) => ({ ...prev, idLocal: String(paramLocal) }));
              } else if (locais.length > 0) {
                setForm((prev) => ({ ...prev, idLocal: String(locais[0].idLocal) }));
              }
            }
          }
        }
      }).catch(() => {});
    }
  }, [searchParams]);

  const carregarProdutos = async () => {
    try {
      const res = await api.get("/produtos");
      setProdutos(res || []);
    } catch (err) {
      addToast(err.message || "Erro ao carregar produtos.", "error");
    }
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.append("tipo", filtroTipo);
      if (filtroJustificativa) params.append("justificativa", filtroJustificativa);

      const res = await api.get(`/ajustes-estoque?${params.toString()}`);
      setHistorico(res || []);
    } catch (err) {
      addToast(err.message || "Erro ao carregar trilha de auditoria.", "error");
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Quando o produto é selecionado, buscar seus lotes
  const handleProdutoChange = async (idProd) => {
    setForm((prev) => ({ ...prev, idProd, idLote: "", idLocal: "", quantidade: "" }));
    setLotesDisponiveis([]);
    setLocaisDisponiveis([]);

    if (!idProd) return;

    try {
      const prod = await api.get(`/produtos/${idProd}`);
      if (prod && prod.lotes) {
        setLotesDisponiveis(prod.lotes);
      }
    } catch (err) {
      addToast(err.message || "Erro ao carregar lotes do produto.", "error");
    }
  };

  // Quando o lote é selecionado, carregar seus locais físicos
  const handleLoteChange = (idLote) => {
    setForm((prev) => ({ ...prev, idLote, idLocal: "", quantidade: "" }));
    setLocaisDisponiveis([]);

    if (!idLote) return;

    const lote = lotesDisponiveis.find((l) => String(l.idLote) === String(idLote));
    if (lote && lote.locais) {
      setLocaisDisponiveis(lote.locais);
      // Pré-selecionar o primeiro local com saldo se houver
      if (lote.locais.length === 1) {
        setForm((prev) => ({ ...prev, idLocal: String(lote.locais[0].idLocal) }));
      }
    }
  };

  // Local selecionado
  const localSelecionado = locaisDisponiveis.find((ll) => String(ll.idLocal) === String(form.idLocal));
  const loteSelecionado = lotesDisponiveis.find((l) => String(l.idLote) === String(form.idLote));
  const produtoSelecionado = produtos.find((p) => String(p.idProd) === String(form.idProd));

  const saldoAtualLocal = localSelecionado ? localSelecionado.quantidade : 0;
  const saldoAtualLote = loteSelecionado ? loteSelecionado.quantidadeAtual : 0;

  // Cálculo em tempo real do novo saldo resultante
  const qtdAjusteNum = Number(form.quantidade) || 0;
  let novoSaldoLoteCalculado = saldoAtualLote;
  let novoSaldoLocalCalculado = saldoAtualLocal;

  if (form.tipo === "BAIXA") {
    novoSaldoLoteCalculado = Math.max(0, saldoAtualLote - qtdAjusteNum);
    novoSaldoLocalCalculado = Math.max(0, saldoAtualLocal - qtdAjusteNum);
  } else if (form.tipo === "ENTRADA") {
    novoSaldoLoteCalculado = saldoAtualLote + qtdAjusteNum;
    novoSaldoLocalCalculado = saldoAtualLocal + qtdAjusteNum;
  }

  // Validação preliminar do formulário
  const validarFormulario = () => {
    if (!form.idProd) {
      addToast("Selecione o produto a ser ajustado.", "warning");
      return false;
    }
    if (!form.idLote) {
      addToast("Selecione o lote do produto.", "warning");
      return false;
    }
    if (!form.idLocal) {
      addToast("Selecione o local físico / gaveteiro.", "warning");
      return false;
    }
    if (!qtdAjusteNum || qtdAjusteNum <= 0 || !Number.isInteger(qtdAjusteNum)) {
      addToast("Informe uma quantidade inteira positiva.", "warning");
      return false;
    }
    if (form.tipo === "BAIXA" && qtdAjusteNum > saldoAtualLocal) {
      addToast(
        `A baixa de ${qtdAjusteNum} excede o saldo disponível no local (${saldoAtualLocal} un).`,
        "error"
      );
      return false;
    }
    if (!form.observacao || form.observacao.trim().length < 15) {
      addToast(
        "A observação detalhada de auditoria deve conter pelo menos 15 caracteres.",
        "warning"
      );
      return false;
    }
    return true;
  };

  const handleAbrirConfirmacao = (e) => {
    e.preventDefault();
    if (validarFormulario()) {
      setConfirmModalAberto(true);
    }
  };

  const handleConfirmarAjuste = async () => {
    setSubmitting(true);
    try {
      await api.post("/ajustes-estoque", {
        idProd: Number(form.idProd),
        idLote: Number(form.idLote),
        idLocal: Number(form.idLocal),
        tipo: form.tipo,
        quantidade: Number(form.quantidade),
        justificativa: form.justificativa,
        observacao: form.observacao.trim()
      });

      addToast("Ajuste manual de estoque registrado e auditado com sucesso!", "success");
      setConfirmModalAberto(false);

      // Limpar formulário
      setForm({
        idProd: "",
        idLote: "",
        idLocal: "",
        tipo: "BAIXA",
        quantidade: "",
        justificativa: "VENCIMENTO",
        observacao: ""
      });
      setLotesDisponiveis([]);
      setLocaisDisponiveis([]);

      // Recarregar histórico e produtos
      carregarHistorico();
      carregarProdutos();
    } catch (err) {
      addToast(err.message || "Erro ao registrar ajuste de estoque.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Exportação de Auditoria
  const colunasExport = [
    "Data/Hora",
    "Tipo",
    "SKU",
    "Produto",
    "Lote",
    "Local",
    "Qtd",
    "Saldo Ant",
    "Saldo Post",
    "Justificativa",
    "Responsável",
    "Observação"
  ];

  const linhasExport = historico.map((m) => [
    formatarDataHora(m.dataHora),
    m.tipo,
    m.lote?.produto?.sku || "-",
    m.lote?.produto?.nome || "-",
    m.lote?.numLote || "-",
    m.local?.codigo || "-",
    m.quantidade,
    m.saldoAnterior ?? "-",
    m.saldoPosterior ?? "-",
    m.justificativa || "-",
    m.usuario?.nome || "Sistema",
    m.observacao || "-"
  ]);

  const handleExportarPdf = () => {
    exportarPDF({
      titulo: "TRILHA DE AUDITORIA DE MOVIMENTAÇÕES DE ESTOQUE",
      filtrosTexto: `Tipo: ${filtroTipo || "Todos"} | Justificativa: ${filtroJustificativa || "Todas"}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: "Auditoria_Movimentacoes_Loja_Guarani"
    });
  };

  const handleExportarExcel = () => {
    exportarExcel({
      titulo: "TRILHA DE AUDITORIA DE MOVIMENTAÇÕES DE ESTOQUE",
      filtrosTexto: `Tipo: ${filtroTipo || "Todos"} | Justificativa: ${filtroJustificativa || "Todas"}`,
      colunas: colunasExport,
      linhas: linhasExport,
      nomeArquivo: "Auditoria_Movimentacoes_Loja_Guarani"
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Cabeçalho */}
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
              Ajuste Manual e Auditoria de Estoque
            </h1>
            <TooltipInfo texto="Operação exclusiva da Proprietária. Permite regularizações de estoque por quebra, vencimento, furto ou inventário físico, com registro imutável no histórico de movimentações." />
          </div>
          <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "4px" }}>
            Realize baixas e entradas avulsas com justificativa mandatória e consulte o log de movimentações à prova de adulteração.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "20px",
              background: "#EEF2FF",
              color: "#4338CA",
              fontSize: "0.75rem",
              fontWeight: "600"
            }}
          >
            <ShieldCheck size={14} /> Perfil Exclusivo: Proprietária
          </span>
        </div>
      </div>

      {/* Grid Principal: Formulário de Ajuste à Esquerda + Resumo de Saldo à Direita */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: "20px" }}>
        {/* Formulário de Ajuste */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              paddingBottom: "12px",
              borderBottom: "1px solid #E2E8F0",
              fontWeight: "600",
              color: "var(--color-navy)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <SlidersHorizontal size={18} /> Novo Registro de Ajuste Manual
          </div>

          <form onSubmit={handleAbrirConfirmacao} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Tipo de Ajuste (Botões de Alternância) */}
            <div>
              <label className="form-label" style={{ marginBottom: "6px" }}>
                Tipo de Operação *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tipo: "BAIXA" }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: form.tipo === "BAIXA" ? "2px solid #EF4444" : "1px solid #CBD5E1",
                    background: form.tipo === "BAIXA" ? "#FEF2F2" : "#FFFFFF",
                    color: form.tipo === "BAIXA" ? "#DC2626" : "#475569",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <ArrowDownCircle size={18} /> BAIXA (Perda / Descarte)
                </button>

                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, tipo: "ENTRADA" }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: form.tipo === "ENTRADA" ? "2px solid #10B981" : "1px solid #CBD5E1",
                    background: form.tipo === "ENTRADA" ? "#ECFDF5" : "#FFFFFF",
                    color: form.tipo === "ENTRADA" ? "#059669" : "#475569",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <ArrowUpCircle size={18} /> ENTRADA (Sobra de Inventário)
                </button>
              </div>
            </div>

            {/* Seleção do Produto */}
            <div>
              <label className="form-label">Produto *</label>
              <select
                className="form-control"
                value={form.idProd}
                onChange={(e) => handleProdutoChange(e.target.value)}
                required
              >
                <option value="">Selecione o produto...</option>
                {produtos.map((p) => (
                  <option key={p.idProd} value={p.idProd}>
                    [{p.sku}] {p.nome} — Saldo Total: {p.estoqueAtual} {p.unidMedida}
                  </option>
                ))}
              </select>
            </div>

            {/* Lote e Local Físico em 2 Colunas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label">Lote *</label>
                <select
                  className="form-control"
                  value={form.idLote}
                  onChange={(e) => handleLoteChange(e.target.value)}
                  disabled={!form.idProd || lotesDisponiveis.length === 0}
                  required
                >
                  <option value="">
                    {!form.idProd
                      ? "Selecione o produto primeiro"
                      : lotesDisponiveis.length === 0
                      ? "Nenhum lote cadastrado"
                      : "Selecione o lote..."}
                  </option>
                  {lotesDisponiveis.map((l) => (
                    <option key={l.idLote} value={l.idLote}>
                      {l.numLote} (Saldo: {l.quantidadeAtual} un) {l.dataValidade ? `— Val: ${formatarData(l.dataValidade)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Local Físico / Gaveta *</label>
                <select
                  className="form-control"
                  value={form.idLocal}
                  onChange={(e) => setForm((prev) => ({ ...prev, idLocal: e.target.value }))}
                  disabled={!form.idLote || locaisDisponiveis.length === 0}
                  required
                >
                  <option value="">
                    {!form.idLote
                      ? "Selecione o lote primeiro"
                      : locaisDisponiveis.length === 0
                      ? "Sem alocação"
                      : "Selecione a gaveta..."}
                  </option>
                  {locaisDisponiveis.map((ll) => (
                    <option key={ll.idLocal} value={ll.idLocal}>
                      {ll.local?.codigo || `Local #${ll.idLocal}`} (Qtd: {ll.quantidade} un)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Justificativa e Quantidade */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label">Justificativa do Ajuste *</label>
                <select
                  className="form-control"
                  value={form.justificativa}
                  onChange={(e) => setForm((prev) => ({ ...prev, justificativa: e.target.value }))}
                  required
                >
                  <option value="VENCIMENTO">Vencimento / Prazo Expirado</option>
                  <option value="QUEBRA">Quebra / Avaria Física</option>
                  <option value="ROUBO">Furto / Roubo Identificado</option>
                  <option value="INVENTARIO">Ajuste de Inventário / Contagem</option>
                </select>
              </div>

              <div>
                <label className="form-label">Quantidade a Ajustar *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-control"
                  placeholder="Ex: 5"
                  value={form.quantidade}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Observação Detalhada com Contador de Caracteres (Mínimo 15) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Observação Detalhada de Auditoria * (Mínimo 15 caracteres)
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: form.observacao.trim().length >= 15 ? "#059669" : "#DC2626"
                  }}
                >
                  {form.observacao.trim().length} / 15 caracteres
                </span>
              </div>
              <textarea
                className="form-control"
                rows="3"
                minLength={15}
                style={{ width: "100%", minHeight: "85px", resize: "vertical", boxSizing: "border-box" }}
                placeholder="Descreva o motivo detalhado do ajuste manual, número do laudo de descarte ou circunstância da avaria..."
                value={form.observacao}
                onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                required
              />
            </div>

            {/* Botão de Envio */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={submitting}
                className={form.tipo === "BAIXA" ? "btn btn-danger" : "btn btn-primary"}
                style={{ padding: "10px 24px", fontWeight: "600" }}
              >
                {form.tipo === "BAIXA" ? "Revisar Baixa Manual" : "Revisar Entrada Manual"}
              </button>
            </div>
          </form>
        </div>

        {/* Painel Lateral: Simulação de Saldo em Tempo Real */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                paddingBottom: "12px",
                borderBottom: "1px solid #E2E8F0",
                fontWeight: "600",
                color: "var(--color-navy)",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Package size={18} /> Simulação de Impacto no Saldo
            </div>

            {/* Resumo do Produto Selecionado */}
            <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: "600" }}>PRODUTO</div>
              <div style={{ fontWeight: "700", color: "#1E293B", fontSize: "0.9375rem" }}>
                {produtoSelecionado ? produtoSelecionado.nome : "Nenhum produto selecionado"}
              </div>
              {produtoSelecionado && (
                <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                  SKU: {produtoSelecionado.sku} | Unidade: {produtoSelecionado.unidMedida}
                </div>
              )}
            </div>

            {/* Comparativo Antes e Depois */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* Saldo Atual */}
              <div
                style={{
                  background: "#F1F5F9",
                  padding: "12px",
                  borderRadius: "8px",
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: "600" }}>
                  SALDO ATUAL (LOCAL)
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#334155" }}>
                  {localSelecionado ? `${saldoAtualLocal}` : "—"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                  {localSelecionado ? `em ${localSelecionado.local?.codigo}` : "Selecione local"}
                </div>
              </div>

              {/* Novo Saldo Previsto */}
              <div
                style={{
                  background: form.tipo === "BAIXA" ? "#FEF2F2" : "#ECFDF5",
                  border: form.tipo === "BAIXA" ? "1px solid #FCA5A5" : "1px solid #A7F3D0",
                  padding: "12px",
                  borderRadius: "8px",
                  textAlign: "center"
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: form.tipo === "BAIXA" ? "#DC2626" : "#059669"
                  }}
                >
                  NOVO SALDO PREVISTO
                </div>
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: form.tipo === "BAIXA" ? "#B91C1C" : "#047857"
                  }}
                >
                  {localSelecionado && qtdAjusteNum > 0 ? `${novoSaldoLocalCalculado}` : "—"}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: form.tipo === "BAIXA" ? "#B91C1C" : "#047857"
                  }}
                >
                  {qtdAjusteNum > 0
                    ? `${form.tipo === "BAIXA" ? "-" : "+"}${qtdAjusteNum} un`
                    : "Aguardando quantidade"}
                </div>
              </div>
            </div>

            {/* Aviso de Auditoria */}
            <div
              style={{
                fontSize: "0.8125rem",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                color: "#92400E",
                padding: "12px",
                borderRadius: "6px",
                display: "flex",
                gap: "8px"
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Atenção:</strong> Movimentações manuais são gravadas com timestamp, ID de usuário e hash de auditoria. Baixas manuais nunca podem exceder o saldo físico existente.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Trilha Imutável de Movimentações (Auditoria) */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={18} color="var(--color-navy)" />
            <span style={{ fontWeight: "700", color: "var(--color-navy)" }}>
              Trilha de Auditoria
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Filtro por Tipo */}
            <select
              className="form-control"
              style={{ fontSize: "0.8125rem", padding: "6px 10px", width: "auto", minWidth: "160px" }}
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos os Tipos</option>
              <option value="BAIXA">BAIXA (Avaria/Descarte)</option>
              <option value="ENTRADA">ENTRADA (Receb./Inventário)</option>
              <option value="SAIDA">SAÍDA (Venda CF-e-SAT)</option>
              <option value="RESERVA">RESERVA (Balcão)</option>
              <option value="CANCELAMENTO_RESERVA">CANCELAMENTO DE RESERVA</option>
            </select>

            {/* Filtro por Justificativa */}
            <select
              className="form-control"
              style={{ fontSize: "0.8125rem", padding: "6px 10px", width: "auto", minWidth: "160px" }}
              value={filtroJustificativa}
              onChange={(e) => setFiltroJustificativa(e.target.value)}
            >
              <option value="">Todas as Justificativas</option>
              <option value="VENCIMENTO">VENCIMENTO</option>
              <option value="QUEBRA">QUEBRA</option>
              <option value="ROUBO">ROUBO</option>
              <option value="INVENTARIO">INVENTARIO</option>
            </select>

            <button
              onClick={carregarHistorico}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8125rem" }}
              title="Filtrar movimentações"
            >
              <Filter size={14} />
            </button>

            <button
              onClick={handleExportarPdf}
              disabled={historico.length === 0}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8125rem" }}
              title="Exportar auditoria em PDF"
            >
              <Download size={14} /> PDF
            </button>

            <button
              onClick={handleExportarExcel}
              disabled={historico.length === 0}
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "0.8125rem" }}
              title="Exportar auditoria em Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>

        {/* Tabela de Auditoria */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Lote</th>
                <th>Local</th>
                <th style={{ textAlign: "right" }}>Qtd</th>
                <th style={{ textAlign: "center" }}>Saldos (Ant → Post)</th>
                <th>Justificativa</th>
                <th>Responsável</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistorico ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>
                    Carregando trilha de movimentações...
                  </td>
                </tr>
              ) : historico.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>
                    Nenhuma movimentação registrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                historico.map((m) => {
                  let badgeTipo = "info";
                  if (m.tipo === "ENTRADA") badgeTipo = "sucesso";
                  else if (m.tipo === "BAIXA") badgeTipo = "perigo";
                  else if (m.tipo === "SAIDA") badgeTipo = "navy";
                  else if (m.tipo === "RESERVA") badgeTipo = "alerta";

                  return (
                    <tr key={m.idMov}>
                      <td style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        {formatarDataHora(m.dataHora)}
                      </td>
                      <td>
                        <Badge tipo={badgeTipo}>{m.tipo}</Badge>
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: "600" }}>
                        {m.lote?.produto?.sku || "-"}
                      </td>
                      <td style={{ fontWeight: "500", color: "var(--color-navy)" }}>
                        {m.lote?.produto?.nome || "-"}
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            background: "#F1F5F9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.75rem"
                          }}
                        >
                          {m.lote?.numLote || "-"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8125rem", fontWeight: "600" }}>
                        {m.local?.codigo || "-"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>
                        {m.tipo === "BAIXA" || m.tipo === "SAIDA" ? `-${m.quantidade}` : `+${m.quantidade}`}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.8125rem" }}>
                        {m.saldoAnterior !== undefined && m.saldoAnterior !== null && m.saldoPosterior !== undefined && m.saldoPosterior !== null ? `${m.saldoAnterior} → ${m.saldoPosterior}` : "—"}
                      </td>
                      <td>
                        {m.justificativa ? (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background:
                                m.justificativa === "VENCIMENTO"
                                  ? "#FEE2E2"
                                  : m.justificativa === "QUEBRA"
                                  ? "#FEF3C7"
                                  : m.justificativa === "ROUBO"
                                  ? "#F3E8FF"
                                  : "#E0F2FE",
                              color:
                                m.justificativa === "VENCIMENTO"
                                  ? "#DC2626"
                                  : m.justificativa === "QUEBRA"
                                  ? "#D97706"
                                  : m.justificativa === "ROUBO"
                                  ? "#7E22CE"
                                  : "#0369A1"
                            }}
                          >
                            {m.justificativa}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "#475569" }}>
                        {m.usuario?.nome || "Sistema"}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "#64748B", maxWidth: "250px" }} title={m.observacao}>
                        {m.observacao || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Dupla Confirmação */}
      <ConfirmModal
        isOpen={confirmModalAberto}
        onClose={() => setConfirmModalAberto(false)}
        onConfirm={handleConfirmarAjuste}
        title={form.tipo === "BAIXA" ? "Confirmar Baixa Manual de Estoque" : "Confirmar Entrada Manual de Estoque"}
        message={`Atenção: Você está prestes a registrar um ajuste de estoque com as seguintes características:
• Operação: ${form.tipo}
• Produto: [${produtoSelecionado?.sku}] ${produtoSelecionado?.nome}
• Lote: ${loteSelecionado?.numLote} | Local: ${localSelecionado?.local?.codigo}
• Quantidade: ${form.quantidade} un (${saldoAtualLocal} → ${novoSaldoLocalCalculado} un)
• Justificativa: ${form.justificativa}
• Observação: "${form.observacao}"

Esta operação é irreversível e ficará permanentemente registrada na trilha de auditoria do sistema. Deseja prosseguir?`}
        confirmLabel={form.tipo === "BAIXA" ? "Sim, Executar Baixa" : "Sim, Executar Entrada"}
        cancelLabel="Cancelar e Revisar"
        isDanger={form.tipo === "BAIXA"}
      />
    </div>
  );
}

export default AjusteEstoquePage;
