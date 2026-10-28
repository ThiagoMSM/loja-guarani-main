import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData } from "../utils/formatters";
import { exportarPDF } from "../utils/exporters";
import { Badge } from "../components/Badge";
import { ConfirmModal } from "../components/ConfirmModal";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  PackageCheck,
  Ban,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

export function OrdensCompraPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ordens, setOrdens] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idFornec, setIdFornec] = useState("");
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState("");
  const [condicoesPagto, setCondicoesPagto] = useState("28/56 dias boleto");
  const [itens, setItens] = useState([]);

  // Modal Cancelar
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  const [idCancelar, setIdCancelar] = useState(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resOcs, resForn, resProd] = await Promise.all([
        api.get("/ordens-compra"),
        api.get("/fornecedores?status=ATIVO"),
        api.get("/produtos")
      ]);
      setOrdens(resOcs);
      setFornecedores(resForn);
      setProdutos(resProd);

      // Tratar pré-preenchimento vindo do Alerta de Estoque
      const idProdParam = searchParams.get("idProd");
      const idFornecParam = searchParams.get("idFornec");
      const qtdParam = searchParams.get("qtd");

      if (idFornecParam) {
        setIdFornec(idFornecParam);
      } else if (resForn.length > 0 && !idFornec) {
        setIdFornec(String(resForn[0].idFornec));
      }

      if (idProdParam) {
        const prod = resProd.find((p) => p.idProd === Number(idProdParam));
        if (prod) {
          setItens([
            {
              idProd: prod.idProd,
              quantidadePedida: Number(qtdParam || 10),
              precoUnitCompra: Number((prod.precoPUnid * 0.5).toFixed(2))
            }
          ]);
        }
      } else if (itens.length === 0 && resProd.length > 0) {
        setItens([
          {
            idProd: resProd[0].idProd,
            quantidadePedida: 10,
            precoUnitCompra: Number((resProd[0].precoPUnid * 0.5).toFixed(2))
          }
        ]);
      }
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar ordens de compra.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const adicionarLinhaItem = () => {
    if (produtos.length === 0) return;
    setItens([
      ...itens,
      {
        idProd: produtos[0].idProd,
        quantidadePedida: 10,
        precoUnitCompra: Number((produtos[0].precoPUnid * 0.5).toFixed(2))
      }
    ]);
  };

  const atualizarItem = (index, campo, valor) => {
    const novosItens = [...itens];
    novosItens[index][campo] = valor;

    if (campo === "idProd") {
      const prod = produtos.find((p) => p.idProd === Number(valor));
      if (prod) {
        novosItens[index].precoUnitCompra = Number((prod.precoPUnid * 0.5).toFixed(2));
      }
    }

    setItens(novosItens);
  };

  const removerItem = (index) => {
    if (itens.length === 1) {
      alertaErro("A Ordem de Compra deve conter ao menos 1 item.");
      return;
    }
    setItens(itens.filter((_, i) => i !== index));
  };

  const totalEstimado = itens.reduce(
    (acc, it) => acc + Number(it.quantidadePedida || 0) * Number(it.precoUnitCompra || 0),
    0
  );

  const handleImportarAlertasFornecedor = async () => {
    if (!idFornec) {
      alertaErro("Selecione um fornecedor para importar os itens em alerta.");
      return;
    }
    try {
      const sugestoes = await api.get(`/ordens-compra/sugerir-itens/${idFornec}`);
      if (sugestoes.length === 0) {
        alertaErro("Nenhum produto deste fornecedor está abaixo do estoque mínimo.");
        return;
      }
      setItens(
        sugestoes.map((s) => ({
          idProd: s.idProd,
          quantidadePedida: s.quantidadePedida,
          precoUnitCompra: s.precoUnitCompra
        }))
      );
      alertaSucesso(`${sugestoes.length} item(ns) em alerta importados com sucesso!`);
    } catch (err) {
      alertaErro(err.message || "Erro ao sugerir itens de reposição.");
    }
  };

  const handleEmitirOc = async (e) => {
    e.preventDefault();
    if (!idFornec || itens.length === 0) {
      alertaErro("Selecione um fornecedor e adicione ao menos um item.");
      return;
    }

    try {
      const payload = {
        idFornec: Number(idFornec),
        dataEntregaPrevista: dataEntregaPrevista || undefined,
        condicoesPagto,
        itens: itens.map((it) => ({
          idProd: Number(it.idProd),
          quantidadePedida: Number(it.quantidadePedida),
          precoUnitCompra: Number(it.precoUnitCompra)
        }))
      };

      const novaOc = await api.post("/ordens-compra", payload);
      alertaSucesso(`Ordem de Compra #${novaOc.idOc} emitida com sucesso!`);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao emitir Ordem de Compra.");
    }
  };

  const handleConfirmarCancelar = async () => {
    if (!idCancelar) return;
    try {
      await api.patch(`/ordens-compra/${idCancelar}/cancelar`);
      alertaSucesso("Ordem de Compra cancelada com sucesso!");
      setIdCancelar(null);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao cancelar Ordem de Compra.");
    }
  };

  const exportarOcPdf = (oc) => {
    const colunas = ["Item", "SKU", "Descrição do Aviamento", "Qtd Pedida", "Qtd Recebida", "Preço Unitário (R$)", "Subtotal Estimado (R$)"];
    const linhas = oc.itens.map((it, idx) => [
      String(idx + 1),
      it.produto.sku,
      it.produto.nome,
      `${it.quantidadePedida} ${it.produto.unidMedida}`,
      `${it.quantidadeRecebida} ${it.produto.unidMedida}`,
      formatarMoeda(it.precoUnitCompra),
      formatarMoeda(it.quantidadePedida * it.precoUnitCompra)
    ]);

    exportarPDF({
      titulo: `ORDEM DE COMPRA #${oc.idOc} - FORNECEDOR: ${oc.fornecedor.razSocial}`,
      filtrosTexto: `Emissão: ${formatarData(oc.dataEmissao)} | Previsão: ${formatarData(oc.dataEntregaPrevista)} | Total: ${formatarMoeda(oc.valorTotalEstimado)}`,
      colunas,
      linhas,
      nomeArquivo: `Ordem_Compra_${oc.idOc}_Loja_Guarani`
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1>Emissão e Gestão de Ordens de Compra</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Formalização e acompanhamento de pedidos de reposição junto aos fornecedores nacionais de aviamentos.
        </p>
      </div>

      {/* Formulário de Nova OC */}
      {isProprietario && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FileSpreadsheet size={20} color="#1D4ED8" />
              <h2>Emitir Nova Ordem de Compra</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleImportarAlertasFornecedor}
            >
              <AlertTriangle size={15} color="#D97706" />
              <span>Importar Itens em Alerta deste Fornecedor</span>
            </button>
          </div>

          <form onSubmit={handleEmitirOc} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
              <label>
                <span>
                  Fornecedor (Apenas Ativos) <span className="req-asterisk">*</span>
                </span>
                <select value={idFornec} onChange={(e) => setIdFornec(e.target.value)}>
                  {fornecedores.map((f) => (
                    <option key={f.idFornec} value={f.idFornec}>
                      {f.nomeFantasia || f.razSocial} ({f.cnpj})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Data Prevista de Entrega</span>
                <input
                  type="date"
                  value={dataEntregaPrevista}
                  onChange={(e) => setDataEntregaPrevista(e.target.value)}
                />
              </label>

              <label>
                <span>Condições de Pagamento</span>
                <input
                  type="text"
                  value={condicoesPagto}
                  onChange={(e) => setCondicoesPagto(e.target.value)}
                />
              </label>
            </div>

            {/* Grade Dinâmica de Itens */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "14px" }}>Itens Solicitados na Ordem de Compra:</strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarLinhaItem}>
                  <Plus size={14} />
                  <span>Adicionar Produto</span>
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>Produto / Aviamento</th>
                      <th style={{ width: "20%" }}>Quantidade Pedida</th>
                      <th style={{ width: "20%" }}>Preço Unitário Compra (R$)</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Subtotal</th>
                      <th style={{ width: "50px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, idx) => {
                      const prod = produtos.find((p) => p.idProd === Number(it.idProd));
                      const subtotal = Number(it.quantidadePedida || 0) * Number(it.precoUnitCompra || 0);

                      return (
                        <tr key={idx}>
                          <td>
                            <select
                              value={it.idProd}
                              onChange={(e) => atualizarItem(idx, "idProd", e.target.value)}
                              style={{ width: "100%", height: "36px" }}
                            >
                              {produtos.map((p) => (
                                <option key={p.idProd} value={p.idProd}>
                                  SKU {p.sku} — {p.nome} ({p.unidMedida})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={it.quantidadePedida}
                              onChange={(e) => atualizarItem(idx, "quantidadePedida", e.target.value)}
                              style={{ width: "100%", height: "36px" }}
                              className="mono"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.precoUnitCompra}
                              onChange={(e) => atualizarItem(idx, "precoUnitCompra", e.target.value)}
                              style={{ width: "100%", height: "36px" }}
                              className="mono"
                            />
                          </td>
                          <td className="mono" style={{ textAlign: "right", fontWeight: "600" }}>
                            {formatarMoeda(subtotal)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removerItem(idx)}
                              style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totalizador e Ação */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
              <div>
                <span style={{ fontSize: "13px", color: "#64748B" }}>Valor Total Estimado:</span>
                <div className="mono" style={{ fontSize: "22px", fontWeight: "700", color: "#1D4ED8" }}>
                  {formatarMoeda(totalEstimado)}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: "0 24px" }}>
                <span>Emitir Ordem de Compra</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Histórico e Listagem de Ordens de Compra */}
      <div className="card">
        <h2>Ordens de Compra Emitidas ({ordens.length})</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
          {ordens.map((oc) => {
            const statusVariant =
              oc.status === "ATENDIDA"
                ? "success"
                : oc.status === "PARCIALMENTE_ATENDIDA"
                ? "warning"
                : oc.status === "CANCELADA"
                ? "danger"
                : "info";

            return (
              <div
                key={oc.idOc}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#FFFFFF"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className="mono" style={{ fontSize: "16px", fontWeight: "700", color: "#0F172A" }}>
                        OC #{oc.idOc}
                      </span>
                      <Badge variant={statusVariant}>{oc.status}</Badge>
                      <span style={{ fontSize: "13px", color: "#64748B" }}>
                        Emissão: {formatarData(oc.dataEmissao)}
                      </span>
                    </div>

                    <div style={{ marginTop: "4px", fontSize: "14px" }}>
                      Fornecedor: <strong>{oc.fornecedor.razSocial}</strong> ({oc.fornecedor.cnpj})
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      Previsão de Entrega: <strong>{formatarData(oc.dataEntregaPrevista)}</strong> | Condições: {oc.condicoesPagto}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                    <div className="mono" style={{ fontSize: "18px", fontWeight: "700", color: "#166534" }}>
                      {formatarMoeda(oc.valorTotalEstimado)}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => exportarOcPdf(oc)}
                        title="Baixar Ordem de Compra em PDF"
                      >
                        <Download size={14} />
                        <span>PDF</span>
                      </button>

                      {isProprietario && (oc.status === "AGUARDANDO_RECEBIMENTO" || oc.status === "PARCIALMENTE_ATENDIDA") && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/recebimento?idOc=${oc.idOc}`)}
                            title="Receber Lote Desta OC"
                          >
                            <PackageCheck size={14} />
                            <span>Receber</span>
                          </button>
                          {oc.itens.every((it) => it.quantidadeRecebida === 0) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#DC2626" }}
                              onClick={() => {
                                setIdCancelar(oc.idOc);
                                setModalCancelarOpen(true);
                              }}
                              title="Cancelar Ordem de Compra"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabela de Itens da OC */}
                <div style={{ marginTop: "12px" }}>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Aviamento</th>
                          <th>Quantidade Pedida</th>
                          <th>Quantidade Recebida</th>
                          <th>Preço Unitário</th>
                          <th style={{ textAlign: "right" }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oc.itens.map((it) => (
                          <tr key={it.idProd}>
                            <td className="mono">{it.produto.sku}</td>
                            <td>{it.produto.nome}</td>
                            <td className="mono">{it.quantidadePedida} {it.produto.unidMedida}</td>
                            <td className="mono" style={{ color: it.quantidadeRecebida >= it.quantidadePedida ? "#166534" : "#D97706", fontWeight: "600" }}>
                              {it.quantidadeRecebida} {it.produto.unidMedida}
                            </td>
                            <td className="mono">{formatarMoeda(it.precoUnitCompra)}</td>
                            <td className="mono" style={{ textAlign: "right" }}>
                              {formatarMoeda(it.quantidadePedida * it.precoUnitCompra)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={modalCancelarOpen}
        onClose={() => setModalCancelarOpen(false)}
        onConfirm={handleConfirmarCancelar}
        title="Cancelar Ordem de Compra"
        message="Atenção: Apenas ordens de compra sem nenhum lote recebido podem ser canceladas. Deseja cancelar esta Ordem de Compra?"
        confirmLabel="Sim, Cancelar OC"
      />
    </div>
  );
}
