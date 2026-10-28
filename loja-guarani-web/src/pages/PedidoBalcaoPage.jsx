import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarDataHora } from "../utils/formatters";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import {
  ClipboardList,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  UserPlus,
  Shield,
  Ban
} from "lucide-react";

export function PedidoBalcaoPage() {
  const { user, isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pedidosAbertos, setPedidosAbertos] = useState([]);

  // Pedido em Construção
  const [termoBusca, setTermoBusca] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidadeItem, setQuantidadeItem] = useState("1");
  const [carrinho, setCarrinho] = useState([]);
  const [idCliente, setIdCliente] = useState("");
  const [reservaAtiva, setReservaAtiva] = useState(true);

  // Modal Novo Cliente Rápido
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteDoc, setNovoClienteDoc] = useState("");
  const [novoClienteTel, setNovoClienteTel] = useState("");

  const carregarDados = async () => {
    try {
      const [resProd, resCli, resPed] = await Promise.all([
        api.get("/produtos?status=ATIVO"),
        api.get("/clientes"),
        api.get("/pedidos-venda?status=AGUARDANDO_PAGAMENTO")
      ]);
      setProdutos(resProd);
      setClientes(resCli);
      setPedidosAbertos(resPed);
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar dados do balcão.");
    }
  };

  useEffect(() => {
    carregarDados();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSelecionarProduto = (prod) => {
    setProdutoSelecionado(prod);
    setQuantidadeItem(String(prod.qtdMinimaVenda || 1));
    setTermoBusca("");
  };

  const handleAdicionarAoCarrinho = (e) => {
    e.preventDefault();
    if (!produtoSelecionado) {
      alertaErro("Selecione um produto para adicionar ao pedido.");
      return;
    }

    const qtd = Number(quantidadeItem);
    if (isNaN(qtd) || qtd <= 0) {
      alertaErro("Informe uma quantidade válida.");
      return;
    }

    // Quantidade mínima
    if (qtd < produtoSelecionado.qtdMinimaVenda) {
      alertaErro(
        `Quantidade mínima exigida para '${produtoSelecionado.nome}' é ${produtoSelecionado.qtdMinimaVenda} ${produtoSelecionado.unidMedida}.`
      );
      return;
    }

    // Validar saldo livre
    if (qtd > produtoSelecionado.saldoLivre) {
      alertaErro(
        `Estoque livre insuficiente. Saldo disponível: ${produtoSelecionado.saldoLivre} ${produtoSelecionado.unidMedida}.`
      );
      return;
    }

    // Adicionar ou somar no carrinho
    const itemExistente = carrinho.find((it) => it.idProd === produtoSelecionado.idProd);
    if (itemExistente) {
      const novaQtd = itemExistente.quantidade + qtd;
      if (novaQtd > produtoSelecionado.saldoLivre) {
        alertaErro(`A quantidade total (${novaQtd}) excede o saldo livre disponível (${produtoSelecionado.saldoLivre}).`);
        return;
      }
      setCarrinho(
        carrinho.map((it) =>
          it.idProd === produtoSelecionado.idProd ? { ...it, quantidade: novaQtd } : it
        )
      );
    } else {
      setCarrinho([
        ...carrinho,
        {
          idProd: produtoSelecionado.idProd,
          sku: produtoSelecionado.sku,
          nome: produtoSelecionado.nome,
          unidMedida: produtoSelecionado.unidMedida,
          precoUnit: produtoSelecionado.precoPUnid,
          quantidade: qtd,
          gaveteiro: produtoSelecionado.lotes?.[0]?.locais?.[0]?.local?.codigo || "Balcão"
        }
      ]);
    }

    setProdutoSelecionado(null);
    setTermoBusca("");
    setQuantidadeItem("1");
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const removerDoCarrinho = (idProd) => {
    setCarrinho(carrinho.filter((it) => it.idProd !== idProd));
  };

  const totalPedido = carrinho.reduce((acc, it) => acc + it.quantidade * it.precoUnit, 0);

  const handleEnviarAoCaixa = async () => {
    if (carrinho.length === 0) {
      alertaErro("Adicione ao menos um item ao pedido.");
      return;
    }

    try {
      const payload = {
        idCliente: idCliente ? Number(idCliente) : undefined,
        reservaAtiva,
        itens: carrinho.map((it) => ({
          idProd: it.idProd,
          quantidade: it.quantidade,
          precoUnit: it.precoUnit
        }))
      };

      const pedidoCriado = await api.post("/pedidos-venda", payload);
      alertaSucesso(`Pedido #${pedidoCriado.idPedido} enviado com sucesso para a fila do caixa!`);
      setCarrinho([]);
      setIdCliente("");
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao formalizar pedido.");
    }
  };

  const handleCancelarPedido = async (idPedido) => {
    try {
      await api.patch(`/pedidos-venda/${idPedido}/cancelar`);
      alertaSucesso(`Pedido #${idPedido} cancelado e reservas de estoque liberadas.`);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao cancelar pedido.");
    }
  };

  const handleSalvarNovoCliente = async (e) => {
    e.preventDefault();
    if (!novoClienteNome) return;

    const nomeLower = novoClienteNome.trim().toLowerCase();
    const ehConsumidorFinal = nomeLower.includes("consumidor final") || nomeLower.includes("consumidor balcão");

    // Se não for Consumidor Final, CPF/CNPJ torna-se obrigatório
    if (!ehConsumidorFinal && !novoClienteDoc.trim()) {
      alertaErro("O preenchimento do CPF ou CNPJ é obrigatório para clientes cadastrados (exceto para Consumidor Final / Balcão).");
      return;
    }

    try {
      const novo = await api.post("/clientes", {
        nome: novoClienteNome,
        cpfCnpj: novoClienteDoc || undefined,
        telefone: novoClienteTel || undefined
      });
      alertaSucesso("Cliente cadastrado com sucesso!");
      setClientes([...clientes, novo]);
      setIdCliente(String(novo.idCliente));
      setModalClienteOpen(false);
      setNovoClienteNome("");
      setNovoClienteDoc("");
      setNovoClienteTel("");
    } catch (err) {
      alertaErro(err.message || "Erro ao cadastrar cliente.");
    }
  };

  // Produtos filtrados na busca
  const produtosSugeridos = termoBusca.trim()
    ? produtos.filter(
        (p) =>
          p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
          p.sku.toLowerCase().includes(termoBusca.toLowerCase()) ||
          (p.ean && p.ean.includes(termoBusca))
      ).slice(0, 6)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1>Pedido de Compra Presencial no Balcão</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Atendimento ágil de balcão: localização física imediata de gaveteiros e reserva temporária de estoque.
        </p>
      </div>

      <div className="grid-4-8">
        {/* Coluna Esquerda: Busca rápida e Adição ao Pedido */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Search size={18} color="#1D4ED8" />
              <h2>Localizar Aviamento no Balcão</h2>
            </div>

            <div style={{ position: "relative" }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar SKU, código de barras ou nome (F2)..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                style={{ width: "100%", height: "42px" }}
              />

              {/* Lista de Sugestões Instantânea */}
              {produtosSugeridos.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "46px",
                    left: 0,
                    right: 0,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "6px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    zIndex: 200,
                    maxHeight: "260px",
                    overflowY: "auto"
                  }}
                >
                  {produtosSugeridos.map((p) => {
                    const gaveteiro = p.lotes?.[0]?.locais?.[0]?.local?.codigo || "Não endereçado";
                    return (
                      <div
                        key={p.idProd}
                        onClick={() => handleSelecionarProduto(p)}
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid #F1F5F9",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="mono" style={{ fontSize: "12px", color: "#1D4ED8", fontWeight: "700" }}>
                              SKU {p.sku}
                            </span>
                            <strong style={{ fontSize: "13px" }}>{p.nome}</strong>
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>
                            Gaveta: <strong className="mono" style={{ color: "#0F172A" }}>{gaveteiro}</strong> | Min: {p.qtdMinimaVenda} {p.unidMedida}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="mono" style={{ fontSize: "13px", fontWeight: "700", color: p.saldoLivre > 0 ? "#166534" : "#DC2626" }}>
                            {p.saldoLivre} {p.unidMedida} livres
                          </span>
                          <div className="mono" style={{ fontSize: "12px", color: "#475569" }}>
                            {formatarMoeda(p.precoPUnid)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quadro de Destaque do Produto Selecionado */}
            {produtoSelecionado && (
              <form onSubmit={handleAdicionarAoCarrinho} style={{ marginTop: "16px", backgroundColor: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <span className="mono" style={{ fontSize: "12px", fontWeight: "700", color: "#1D4ED8" }}>
                      SKU {produtoSelecionado.sku}
                    </span>
                    <h3 style={{ fontSize: "15px" }}>{produtoSelecionado.nome}</h3>
                  </div>
                  <span className="badge badge-success">
                    {produtoSelecionado.saldoLivre} {produtoSelecionado.unidMedida} livres
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#475569", marginBottom: "10px" }}>
                  Localização: <strong className="mono">{produtoSelecionado.lotes?.[0]?.locais?.[0]?.local?.codigo || "Balcão"}</strong> | Preço: <strong className="mono">{formatarMoeda(produtoSelecionado.precoPUnid)}</strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "flex-end" }}>
                  <label>
                    <span>Quantidade ({produtoSelecionado.unidMedida})</span>
                    <input
                      type="number"
                      min={produtoSelecionado.qtdMinimaVenda || 1}
                      max={produtoSelecionado.saldoLivre}
                      required
                      className="mono"
                      value={quantidadeItem}
                      onChange={(e) => setQuantidadeItem(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="btn btn-primary" style={{ height: "40px" }}>
                    <Plus size={16} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Dados do Cliente e Reserva */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2>Cliente & Opções</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalClienteOpen(true)}
              >
                <UserPlus size={14} />
                <span>+ Cliente Rápido</span>
              </button>
            </div>

            <label style={{ marginBottom: "12px" }}>
              <span>Cliente (Opcional — Consumidor Balcão se vazio)</span>
              <select value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
                <option value="">Consumidor Final (Balcão)</option>
                {clientes.map((c) => (
                  <option key={c.idCliente} value={c.idCliente}>
                    {c.nome} {c.cpfCnpj ? `(${c.cpfCnpj})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={reservaAtiva}
                onChange={(e) => setReservaAtiva(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
              <span style={{ fontSize: "13px" }}>
                <strong>Reservar Estoque Imediatamente</strong>
                <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                  Congela o saldo livre evitando que outros atendentes vendam os mesmos itens.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Coluna Direita: Carrinho do Pedido e Fila de Pedidos Abertos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Cesta do Pedido Atual */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2>Cesta do Atendimento ({carrinho.length} item(ns))</h2>
              <div className="mono" style={{ fontSize: "20px", fontWeight: "700", color: "#1D4ED8" }}>
                {formatarMoeda(totalPedido)}
              </div>
            </div>

            {carrinho.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748B", backgroundColor: "#F8FAFC", borderRadius: "6px" }}>
                Nenhum aviamento adicionado ao atendimento. Busque o item à esquerda.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Aviamento</th>
                        <th>Gaveta</th>
                        <th>Qtd</th>
                        <th>Unitário</th>
                        <th style={{ textAlign: "right" }}>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrinho.map((it) => (
                        <tr key={it.idProd}>
                          <td className="mono">{it.sku}</td>
                          <td><strong>{it.nome}</strong></td>
                          <td className="mono">{it.gaveteiro}</td>
                          <td className="mono">{it.quantidade} {it.unidMedida}</td>
                          <td className="mono">{formatarMoeda(it.precoUnit)}</td>
                          <td className="mono" style={{ textAlign: "right", fontWeight: "600" }}>
                            {formatarMoeda(it.quantidade * it.precoUnit)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removerDoCarrinho(it.idProd)}
                              style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ textAlign: "right", marginTop: "8px" }}>
                  <button className="btn btn-primary" onClick={handleEnviarAoCaixa} style={{ padding: "0 28px" }}>
                    <span>Enviar Pedido para o Caixa</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fila de Pedidos em Aberto no Balcão */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2>Fila de Pedidos no Balcão ({pedidosAbertos.length})</h2>
              <span style={{ fontSize: "12px", color: "#64748B" }}>Aguardando pagamento no caixa</span>
            </div>

            {pedidosAbertos.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic" }}>
                Nenhum pedido aguardando no caixa no momento.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pedidosAbertos.map((ped) => {
                  const total = ped.itens.reduce((acc, it) => acc + it.quantidade * it.precoUnit, 0);

                  return (
                    <div
                      key={ped.idPedido}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "6px",
                        padding: "12px",
                        backgroundColor: "#FFFFFF",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="mono" style={{ fontWeight: "700", color: "#1D4ED8" }}>
                            PED #{ped.idPedido}
                          </span>
                          <Badge variant="warning">{ped.status}</Badge>
                          <span style={{ fontSize: "12px", color: "#64748B" }}>
                            {formatarDataHora(ped.dataPedido)}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", marginTop: "2px" }}>
                          Cliente: <strong>{ped.cliente ? ped.cliente.nome : "Consumidor Balcão"}</strong> | Vendedor: {ped.vendedor?.usuario?.nome}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B" }}>
                          {ped.itens.length} produto(s) | Reserva Ativa: {ped.reservaAtiva ? "Sim" : "Não"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong className="mono" style={{ fontSize: "16px", color: "#166534" }}>
                          {formatarMoeda(total)}
                        </strong>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: "10px 16px", fontSize: "13px", minHeight: "38px" }}
                          onClick={() => navigate(`/caixa?idPedido=${ped.idPedido}`)}
                        >
                          <span>Caixa</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: "#DC2626" }}
                          onClick={() => handleCancelarPedido(ped.idPedido)}
                          title="Cancelar Pedido e Liberar Reserva"
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Cadastro Rápido de Cliente */}
      <Modal
        isOpen={modalClienteOpen}
        onClose={() => setModalClienteOpen(false)}
        title="Cadastro Rápido de Cliente no Balcão"
        maxWidth="460px"
      >
        <form onSubmit={handleSalvarNovoCliente} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label>
            <span>
              Nome Completo / Razão Social <span className="req-asterisk">*</span>
            </span>
            <input
              type="text"
              required
              placeholder="Ex: Ateliê Bela Costura"
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
            />
          </label>
          <label>
            <span>
              CPF ou CNPJ <span className="req-asterisk">*</span>
              <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>
                (Obrigatório, exceto para o Consumidor Final / Balcão)
              </span>
            </span>
            <input
              type="text"
              className="mono"
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              value={novoClienteDoc}
              onChange={(e) => setNovoClienteDoc(e.target.value)}
            />
          </label>
          <label>
            <span>Telefone / WhatsApp</span>
            <input
              type="text"
              placeholder="(11) 90000-0000"
              value={novoClienteTel}
              onChange={(e) => setNovoClienteTel(e.target.value)}
            />
          </label>
          <div style={{ marginTop: "8px", textAlign: "right" }}>
            <button type="submit" className="btn btn-primary">
              Salvar Cliente
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}