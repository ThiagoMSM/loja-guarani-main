import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData, formatarDataHora } from "../utils/formatters";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import {
  ShoppingCart,
  Printer,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Zap,
  RotateCcw
} from "lucide-react";

export function CaixaVendaPage() {
  const { user } = useAuth();
  const { alertaSucesso, alertaErro, recarregarAlertas } = useToast();
  const [searchParams] = useSearchParams();

  const [produtos, setProdutos] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idPedido, setIdPedido] = useState(searchParams.get("idPedido") || "");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [desconto, setDesconto] = useState("0.00");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [cpfCnpjNota, setCpfCnpjNota] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [simularFalhaSat, setSimularFalhaSat] = useState(false);

  // Preview FIFO (lista com preview de lotes para cada item)
  const [previewLotes, setPreviewLotes] = useState(null);

  // Resultado da Venda Concluída
  const [vendaConcluida, setVendaConcluida] = useState(null);
  const [modalXmlOpen, setModalXmlOpen] = useState(false);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resProd, resPed] = await Promise.all([
        api.get("/produtos?status=ATIVO"),
        api.get("/pedidos-venda?status=AGUARDANDO_PAGAMENTO")
      ]);
      setProdutos(resProd);
      setPedidosPendentes(resPed);

      const idPedParam = searchParams.get("idPedido");
      if (idPedParam) {
        const ped = resPed.find((p) => p.idPedido === Number(idPedParam));
        if (ped) {
          setIdPedido(String(ped.idPedido));
          if (ped.cliente?.cpfCnpj) setCpfCnpjNota(ped.cliente.cpfCnpj);
        }
      } else if (resProd.length > 0 && !produtoId) {
        setProdutoId(String(resProd[0].idProd));
        setQuantidade(resProd[0].qtdMinimaVenda || 1);
      }
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar dados do caixa.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Atalho F10 para submeter venda
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F10") {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-finalizar-venda");
        if (submitBtn) submitBtn.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pedidoSelecionado = pedidosPendentes.find((p) => p.idPedido === Number(idPedido));
  const produtoAtivo = produtos.find((p) => p.idProd === Number(produtoId));

  const precoUnit = produtoAtivo ? produtoAtivo.precoPUnid : 0;
  
  const subtotal = pedidoSelecionado
    ? pedidoSelecionado.itens.reduce((acc, it) => {
        const precoItem = Number(it.precoUnitPratic || it.precoUnit || it.preco || 0);
        const qtdItem = Number(it.quantidade || 0);
        const subItem = Number(it.subtotal || (qtdItem * precoItem));
        return acc + subItem;
      }, 0)
    : Number((Number(quantidade || 0) * precoUnit).toFixed(2));

  const descNum = Number(Number(desconto || 0).toFixed(2));
  const valorTotalCalculado = Math.max(0, Number((subtotal - descNum).toFixed(2)));

  // Verificação de cliente associado para bloquear CPF/CNPJ
  const clienteDoPedido = pedidoSelecionado?.cliente;
  const temClienteAssociado = Boolean(clienteDoPedido?.cpfCnpj || clienteDoPedido?.nome);

  // Cálculo Dinâmico de Troco
  const valorPagoNum = Number(valorPago || 0);
  const trocoCalculado = valorPagoNum > valorTotalCalculado ? Number((valorPagoNum - valorTotalCalculado).toFixed(2)) : 0;

  // Recalcular Preview FIFO sempre que mudar pedido, produto ou quantidade
  useEffect(() => {
    let itensParaPreview = [];

    if (pedidoSelecionado && pedidoSelecionado.itens?.length > 0) {
      itensParaPreview = pedidoSelecionado.itens.map((it) => ({
        idProd: Number(it.idProd),
        quantidade: Number(it.quantidade)
      }));
    } else if (produtoId && quantidade && Number(quantidade) > 0) {
      itensParaPreview = [
        { idProd: Number(produtoId), quantidade: Number(quantidade) }
      ];
    }

    if (itensParaPreview.length === 0) {
      setPreviewLotes(null);
      return;
    }

    api
      .post("/vendas/preview-fifo", { itens: itensParaPreview })
      .then((res) => {
        if (Array.isArray(res)) {
          setPreviewLotes(res);
        } else {
          setPreviewLotes(null);
        }
      })
      .catch(() => setPreviewLotes(null));
  }, [idPedido, pedidoSelecionado, produtoId, quantidade]);

  const handleMudarPedido = (idPed) => {
    setIdPedido(idPed);
    if (!idPed) {
      setCpfCnpjNota("");
      if (produtos.length > 0 && !produtoId) {
        setProdutoId(String(produtos[0].idProd));
        setQuantidade(produtos[0].qtdMinimaVenda || 1);
      }
      return;
    }
    const ped = pedidosPendentes.find((p) => p.idPedido === Number(idPed));
    if (ped && ped.cliente?.cpfCnpj) {
      setCpfCnpjNota(ped.cliente.cpfCnpj);
    } else {
      setCpfCnpjNota("");
    }
  };

  const handleFinalizarVenda = async (e) => {
    e.preventDefault();

    try {
      let payload;
      if (pedidoSelecionado) {
        if (!pedidoSelecionado.itens || pedidoSelecionado.itens.length === 0) {
          alertaErro("O pedido selecionado não contém itens.");
          return;
        }
        payload = {
          idPedido: Number(pedidoSelecionado.idPedido),
          itens: pedidoSelecionado.itens.map((it) => ({
            idProd: Number(it.idProd),
            quantidade: Number(it.quantidade),
            precoUnit: Number(it.precoUnitPratic || it.precoUnit || it.preco || 0)
          })),
          formaPagamento,
          desconto: descNum,
          cpfCnpjNota: cpfCnpjNota || undefined,
          simularFalhaSat
        };
      } else {
        if (!produtoId || !quantidade || Number(quantidade) <= 0) {
          alertaErro("Selecione um produto e informe uma quantidade válida.");
          return;
        }
        payload = {
          produtoId: Number(produtoId),
          quantidade: Number(quantidade),
          formaPagamento,
          desconto: descNum,
          cpfCnpjNota: cpfCnpjNota || undefined,
          simularFalhaSat
        };
      }

      const resultado = await api.post("/vendas", payload);
      setVendaConcluida(resultado);
      alertaSucesso(`Venda #${resultado.vendaId} confirmada e Cupom SAT emitido com sucesso!`);
      recarregarAlertas();
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao registrar venda.");
    }
  };

  const handleNovaVenda = () => {
    setVendaConcluida(null);
    setIdPedido("");
    setDesconto("0.00");
    setCpfCnpjNota("");
    setValorPago("");
    setSimularFalhaSat(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1>Fechamento de Venda no Caixa &amp; Emissão SAT</h1>
          <p style={{ color: "#64748B", fontSize: "14px" }}>
            Baixa transacional ACID pelo método PEPS/FIFO com emissão itemizada do Cupom Fiscal Eletrônico (SEFAZ-SP).
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Badge variant="success" style={{ padding: "6px 12px", fontSize: "13px" }}>
            <Zap size={14} />
            <span>SAT Online (Homologação SEFAZ)</span>
          </Badge>
        </div>
      </div>

      {!vendaConcluida ? (
        <form onSubmit={handleFinalizarVenda} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card Principal de Venda */}
          <div className="card">
            {/* Importar Pedido do Balcão */}
            {pedidosPendentes.length > 0 && (
              <div style={{ marginBottom: "16px", backgroundColor: "#F8FAFC", padding: "12px", borderRadius: "6px", border: "1px solid #CBD5E1" }}>
                <label>
                  <span style={{ fontWeight: "600" }}>Importar Pedido em Aberto no Balcão</span>
                  <select value={idPedido} onChange={(e) => handleMudarPedido(e.target.value)}>
                    <option value="">Venda Direta no Caixa (Sem Pedido Prévio)</option>
                    {pedidosPendentes.map((ped) => {
                      const totalPed = ped.valorTotal || ped.itens.reduce((acc, it) => acc + Number(it.subtotal || it.quantidade * (it.precoUnitPratic || it.precoUnit || it.preco || 0)), 0);
                      return (
                        <option key={ped.idPedido} value={ped.idPedido}>
                          PED #{ped.idPedido} — {ped.cliente?.nome || "Consumidor Balcão"} ({ped.itens.length} {ped.itens.length === 1 ? "item" : "itens"}) — {formatarMoeda(totalPed)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            )}

            {pedidoSelecionado ? (
              /* Modo Pedido do Balcão Importado (Múltiplos Itens) */
              <>
                <div
                  style={{
                    backgroundColor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "6px",
                    padding: "14px 16px",
                    marginBottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#1E40AF", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Pedido Importado do Balcão
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "#1E3A8A", marginTop: "2px" }}>
                      PED #{pedidoSelecionado.idPedido} — {pedidoSelecionado.cliente?.nome || "Consumidor Balcão"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#3B82F6", marginTop: "2px" }}>
                      Vendedor: {pedidoSelecionado.vendedor?.usuario?.nome || "Balcão"} | Reserva: {pedidoSelecionado.reservaAtiva ? "Estoque Garantido" : "Sem Reserva"}
                    </div>
                  </div>
                  <Badge variant="info">
                    {pedidoSelecionado.itens.length} {pedidoSelecionado.itens.length === 1 ? "item" : "itens"} no Pedido
                  </Badge>
                </div>

                {/* Tabela de Itens do Pedido */}
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155", display: "block", marginBottom: "8px" }}>
                    Itens a Faturar e Baixar do Pedido:
                  </span>
                  <div className="table-container" style={{ margin: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Produto / Aviamento</th>
                          <th style={{ textAlign: "center" }}>Quantidade</th>
                          <th style={{ textAlign: "right" }}>Preço Unit.</th>
                          <th style={{ textAlign: "right" }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidoSelecionado.itens.map((it) => {
                          const precoUnitItem = Number(it.precoUnitPratic || it.precoUnit || it.preco || 0);
                          const qtdItem = Number(it.quantidade || 0);
                          const subtotalItem = Number(it.subtotal || (qtdItem * precoUnitItem));

                          return (
                            <tr key={it.idItem || it.idProd}>
                              <td className="mono" style={{ fontWeight: "600", color: "#1D4ED8" }}>
                                {it.produto?.sku || it.sku || `PRD-${it.idProd}`}
                              </td>
                              <td>
                                <strong>{it.produto?.nome || it.nome}</strong>
                                {it.produto?.unidMedida && (
                                  <span style={{ fontSize: "11px", color: "#64748B", marginLeft: "6px" }}>
                                    ({it.produto.unidMedida})
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "center", fontWeight: "600" }}>
                                {qtdItem}
                              </td>
                              <td className="mono" style={{ textAlign: "right" }}>
                                {formatarMoeda(precoUnitItem)}
                              </td>
                              <td className="mono" style={{ textAlign: "right", fontWeight: "700" }}>
                                {formatarMoeda(subtotalItem)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: "#F8FAFC" }}>
                          <td colSpan={4} style={{ textAlign: "right", fontWeight: "600" }}>
                            Subtotal dos Itens:
                          </td>
                          <td className="mono" style={{ textAlign: "right", fontWeight: "700" }}>
                            {formatarMoeda(subtotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Desconto Comercial do Pedido */}
                <div style={{ marginBottom: "14px", maxWidth: "260px" }}>
                  <label>
                    <span>Desconto Comercial (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mono"
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value)}
                    />
                  </label>
                </div>
              </>
            ) : (
              /* Modo Venda Direta no Caixa (1 Produto Avulso) */
              <>
                {/* Seleção de Produto */}
                <label style={{ marginBottom: "14px" }}>
                  <span>
                    Selecione o Aviamento / Produto <span className="req-asterisk">*</span>
                  </span>
                  <select
                    value={produtoId}
                    onChange={(e) => {
                      setProdutoId(e.target.value);
                      const p = produtos.find((x) => x.idProd === Number(e.target.value));
                      if (p) setQuantidade(p.qtdMinimaVenda || 1);
                    }}
                  >
                    {produtos.map((p) => (
                      <option key={p.idProd} value={p.idProd}>
                        SKU {p.sku} — {p.nome} (Saldo Físico: {p.estoqueAtual} {p.unidMedida} | Preço: {formatarMoeda(p.precoPUnid)})
                      </option>
                    ))}
                  </select>
                </label>

                {/* Quadro de Destaque Central (CT-BAIXA-04) */}
                {produtoAtivo && (
                  <div
                    style={{
                      backgroundColor: "#F1F5F9",
                      border: "1px solid #CBD5E1",
                      borderRadius: "6px",
                      padding: "14px",
                      textAlign: "center",
                      marginBottom: "16px"
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", fontWeight: "600" }}>
                      Item Selecionado para Baixa
                    </span>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "#0F172A", marginTop: "2px" }}>
                      Produto Selecionado: {produtoAtivo.nome}
                    </div>
                    <div className="mono" style={{ fontSize: "13px", color: "#1D4ED8", marginTop: "2px" }}>
                      Produto ID: {produtoAtivo.idProd} | SKU: {produtoAtivo.sku} | NCM: {produtoAtivo.ncm}
                    </div>
                  </div>
                )}

                {/* Campos Read-Only e Inputs de Quantidade (CT-BAIXA-01, CT-BAIXA-03) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" }}>
                  <label>
                    <span>Quantidade Disponível Livre (Calculado)</span>
                    <input
                      type="text"
                      readOnly
                      className="readonly-field mono"
                      value={produtoAtivo ? `${produtoAtivo.saldoLivre} ${produtoAtivo.unidMedida}` : "0"}
                    />
                  </label>

                  <label>
                    <span>Custo / Preço Unitário (R$)</span>
                    <input
                      type="text"
                      readOnly
                      className="readonly-field mono"
                      value={produtoAtivo ? formatarMoeda(produtoAtivo.precoPUnid) : "R$ 0,00"}
                    />
                  </label>

                  <label>
                    <span>
                      Quantidade de Venda <span className="req-asterisk">*</span>
                    </span>
                    <input
                      type="number"
                      min="1"
                      required
                      className="mono"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                    />
                  </label>

                  <label>
                    <span>Desconto Comercial (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mono"
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {/* Valor Total a Pagar (Modificado conforme pedido) */}
            <div style={{ marginTop: "14px" }}>
              <label>
                <span>Valor total a pagar:</span>
                <input
                  type="text"
                  readOnly
                  className="readonly-field mono"
                  style={{ fontSize: "18px", fontWeight: "700", color: "#166534", height: "46px" }}
                  value={formatarMoeda(valorTotalCalculado)}
                />
              </label>
            </div>

            {/* Campos de Valor Pago e Troco Dinâmico */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
              <label>
                <span>Valor pago pelo cliente (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mono"
                  placeholder="0.00"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                />
              </label>

              <label>
                <span>Troco (R$)</span>
                <input
                  type="text"
                  readOnly
                  className="readonly-field mono"
                  style={{ fontWeight: "700", color: "#1D4ED8" }}
                  value={formatarMoeda(trocoCalculado)}
                />
              </label>
            </div>

            {/* Opções de Pagamento e Fiscal (Com CPF/CNPJ bloqueado se houver cliente associado) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
              <label>
                <span>
                  Forma de Pagamento <span className="req-asterisk">*</span>
                </span>
                <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                  <option value="PIX">PIX (Instantâneo)</option>
                  <option value="DINHEIRO">Dinheiro em Espécie</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                </select>
              </label>

              <label>
                <span>
                  CPF / CNPJ na Nota Fiscal
                  {temClienteAssociado && <span style={{ fontSize: "11px", color: "#1D4ED8", marginLeft: "6px" }}>(Vindo do Cliente)</span>}
                </span>
                <input
                  type="text"
                  className={`mono ${temClienteAssociado ? "readonly-field" : ""}`}
                  readOnly={temClienteAssociado}
                  placeholder="000.000.000-00 (Opcional)"
                  value={cpfCnpjNota}
                  onChange={(e) => !temClienteAssociado && setCpfCnpjNota(e.target.value)}
                />
              </label>
            </div>

            {/* Preview do Motor PEPS/FIFO (Múltiplos Itens ou Item Único) */}
            {previewLotes && previewLotes.length > 0 && (
              <div style={{ marginTop: "16px", backgroundColor: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                  <Boxes size={16} color="#1D4ED8" />
                  <strong style={{ fontSize: "13px", color: "#0F172A" }}>
                    Preview do Motor PEPS/FIFO (Lotes e Gaveteiros a Consumir):
                  </strong>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {previewLotes.map((itemPrev) => (
                    <div
                      key={itemPrev.idProd}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "6px",
                        padding: "10px 12px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <div>
                          <span className="mono" style={{ fontWeight: "700", color: "#1D4ED8" }}>SKU {itemPrev.sku}</span>
                          <span style={{ fontWeight: "600", marginLeft: "8px", color: "#0F172A" }}>{itemPrev.nome}</span>
                        </div>
                        <span style={{ fontSize: "12px", color: "#475569" }}>
                          Total a retirar: <strong>{itemPrev.quantidadeSolicitada} un</strong>
                        </span>
                      </div>

                      {!itemPrev.saldoSuficiente && (
                        <div style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600", marginBottom: "6px" }}>
                          ⚠️ Saldo insuficiente! Faltam {itemPrev.deficit} unidades em estoque.
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {itemPrev.lotesPrevistos && itemPrev.lotesPrevistos.length > 0 ? (
                          itemPrev.lotesPrevistos.map((lp) => (
                            <div
                              key={lp.idLote}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "12px",
                                backgroundColor: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                padding: "6px 10px",
                                borderRadius: "4px"
                              }}
                            >
                              <div>
                                Lote <code className="mono">{lp.numLote}</code> | Validade: <strong>{formatarData(lp.dataValidade)}</strong> | Gaveteiro: <strong>{lp.locais && lp.locais.length > 0 ? lp.locais.map((l) => l.codigoLocal).join(", ") : "N/D"}</strong>
                              </div>
                              <div className="mono">
                                Dedução: <strong style={{ color: "#DC2626" }}>-{lp.quantidadeRetirar} un</strong> (Restará: {lp.saldoAposVenda} un)
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: "12px", color: "#64748B", fontStyle: "italic" }}>
                            Nenhum lote disponível para atender a este item.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checkbox de Demonstração de Falha SAT (Exceção E3) */}
            <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "6px" }}>
              <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={simularFalhaSat}
                  onChange={(e) => setSimularFalhaSat(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
                <span style={{ fontSize: "13px", color: "#92400E" }}>
                  <strong>Simular Falha de Comunicação com Equipamento SAT (Exceção E3)</strong>
                  <span style={{ display: "block", fontSize: "11px", color: "#B45309" }}>
                    Testará o Rollback Transacional ACID: desfaz 100% das baixas de estoque sem inconsistências.
                  </span>
                </span>
              </label>
            </div>

            {/* Botão de Finalização F10 */}
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                id="btn-finalizar-venda"
                type="submit"
                className="btn btn-primary"
                style={{ height: "46px", padding: "0 32px", fontSize: "15px" }}
              >
                <ShoppingCart size={18} />
                <span>Confirmar Venda, Baixar Lote (FIFO) e Emitir SAT (F10)</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Tela de Confirmação de Venda e Extrato Fiscal SAT */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Banner de Sucesso */}
          <div
            style={{
              backgroundColor: "#DCFCE7",
              border: "1px solid #16A34A",
              borderRadius: "8px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <CheckCircle2 size={32} color="#16A34A" />
              <div>
                <strong style={{ fontSize: "16px", color: "#166534" }}>
                  Venda #{vendaConcluida.vendaId} Registrada com Sucesso!
                </strong>
                <div style={{ fontSize: "13px", color: "#15803D" }}>
                  Cupom Fiscal Eletrônico (CF-e-SAT) #{vendaConcluida.cupomSat?.numeroCupom} emitido e homologado.
                </div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleNovaVenda}>
              <RotateCcw size={16} />
              <span>Nova Venda</span>
            </button>
          </div>

          {/* Alertas de Estoque Mínimo se disparados */}
          {vendaConcluida.alertaEstoqueMinimoAtivo && (
            <div
              style={{
                backgroundColor: "#FEF3C7",
                border: "1px solid #D97706",
                borderRadius: "6px",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                color: "#92400E",
                fontSize: "13px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
                <AlertTriangle size={20} color="#D97706" />
                <span>Atenção: Aviamento(s) em Nível Crítico / Reposição Preventiva Recomendada!</span>
              </div>
              {vendaConcluida.alertasGerados && vendaConcluida.alertasGerados.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "24px" }}>
                  {vendaConcluida.alertasGerados.map((al) => (
                    <li key={al.idProd}>
                      <strong>{al.nome}</strong> (SKU: {al.sku}) — Restam <strong>{al.estoqueAtual}</strong> un (Estoque Mínimo: {al.estoqueMin} un).
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  O aviamento vendido atingiu ou ficou abaixo do nível mínimo de segurança (Restam {vendaConcluida.estoqueRestanteProduto} un).
                </div>
              )}
            </div>
          )}

          {/* Extrato do Cupom SAT e Botões de Impressão */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2>Extrato do Cupom Fiscal Eletrônico (CF-e-SAT)</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalXmlOpen(true)}
                  title="Inspecionar XML Gerado pelo SAT"
                >
                  <FileCode size={14} />
                  <span>Ver XML SEFAZ</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                  title="Imprimir Extrato do Cupom"
                >
                  <Printer size={14} />
                  <span>Imprimir Cupom</span>
                </button>
              </div>
            </div>

            {/* Simulação Visual do Extrato Térmico do SAT */}
            <div
              className="cupom-sat-print"
              style={{
                backgroundColor: "#FFFBEB",
                border: "1px dashed #B45309",
                borderRadius: "6px",
                padding: "20px",
                fontFamily: "var(--font-family-mono)",
                fontSize: "12px",
                lineHeight: "1.4",
                maxWidth: "460px",
                margin: "0 auto"
              }}
            >
              <div style={{ textAlign: "center", borderBottom: "1px dashed #B45309", paddingBottom: "10px", marginBottom: "10px" }}>
                <strong>LOJA GUARANI - LOJA DO TURQUINHO</strong>
                <div>HACIB CAMASMIE &amp; CIA LTDA</div>
                <div>CNPJ: 60.716.586/0001-17 | IE: 110.042.490.114</div>
                <div>Rua Três Rios, 148 — Bom Retiro — São Paulo/SP</div>
              </div>

              <div style={{ textAlign: "center", marginBottom: "10px" }}>
                <strong>EXTRATO Nº {vendaConcluida.cupomSat?.numeroCupom}</strong>
                <div>CUPOM FISCAL ELETRÔNICO — SAT</div>
              </div>

              <div style={{ borderBottom: "1px dashed #B45309", paddingBottom: "8px", marginBottom: "8px" }}>
                <div style={{ fontWeight: "700", marginBottom: "4px" }}>ITENS DO CUPOM FISCAL:</div>
                {vendaConcluida.cupomSat?.itemDiscriminadoXml ? (
                  vendaConcluida.cupomSat.itemDiscriminadoXml.split(" | ").map((itemStr, idx) => (
                    <div key={idx} style={{ paddingLeft: "4px", fontSize: "11px", marginBottom: "2px" }}>
                      • {itemStr}
                    </div>
                  ))
                ) : (
                  <div>Item: {vendaConcluida.produtoNome || "Aviamentos"}</div>
                )}
                <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed #FDE68A" }}>
                  <div>Total Baixado: {vendaConcluida.quantidadeBaixada} un</div>
                  <div>Total Pago: <strong>{formatarMoeda(vendaConcluida.valorTotal)}</strong></div>
                  <div>Meio Pagto: {formaPagamento}</div>
                </div>
              </div>

              <div style={{ fontSize: "11px", wordBreak: "break-all", textAlign: "center" }}>
                <div>CHAVE DE ACESSO SAT:</div>
                <strong>{vendaConcluida.cupomSat?.chaveAcesso}</strong>
                <div style={{ marginTop: "6px" }}>{formatarDataHora(new Date())}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inspecionar XML SAT */}
      <Modal
        isOpen={modalXmlOpen}
        onClose={() => setModalXmlOpen(false)}
        title="Documento XML CF-e-SAT (Portaria CAT 147/2012)"
        maxWidth="750px"
      >
        <pre
          className="mono"
          style={{
            backgroundColor: "#0F172A",
            color: "#38BDF8",
            padding: "16px",
            borderRadius: "6px",
            fontSize: "11px",
            maxHeight: "450px",
            overflow: "auto"
          }}
        >
          {vendaConcluida?.cupomSat?.xmlConteudo}
        </pre>
      </Modal>
    </div>
  );
}