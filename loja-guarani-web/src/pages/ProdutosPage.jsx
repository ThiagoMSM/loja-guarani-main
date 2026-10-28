import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda } from "../utils/formatters";
import { TooltipInfo } from "../components/TooltipInfo";
import { ConfirmModal } from "../components/ConfirmModal";
import { Badge } from "../components/Badge";
import { Package, Search, Plus, Edit2, Trash2, ShieldAlert } from "lucide-react";

export function ProdutosPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();

  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [locais, setLocais] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idEditando, setIdEditando] = useState(null);
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [ncm, setNcm] = useState("54011012");
  const [cfopPadrao, setCfopPadrao] = useState("5102");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [idCateg, setIdCateg] = useState("");
  const [unidMedida, setUnidMedida] = useState("UN");
  const [precoPUnid, setPrecoPUnid] = useState("");
  const [qtdMinimaVenda, setQtdMinimaVenda] = useState("1");
  const [estoqueMin, setEstoqueMin] = useState("5");

  // Lote de abertura inicial opcional
  const [incluirLoteInicial, setIncluirLoteInicial] = useState(false);
  const [qtdInicial, setQtdInicial] = useState("");
  const [idLocalInicial, setIdLocalInicial] = useState("");
  const [custoInicial, setCustoInicial] = useState("");

  // Modal Exclusão / Inativação
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [idExcluir, setIdExcluir] = useState(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resProd, resCat, resLoc] = await Promise.all([
        api.get("/produtos"),
        api.get("/categorias"),
        api.get("/locais")
      ]);
      setProdutos(resProd);
      setCategorias(resCat);
      setLocais(resLoc);
      if (resCat.length > 0 && !idCateg) setIdCateg(String(resCat[0].idCateg));
      if (resLoc.length > 0 && !idLocalInicial) setIdLocalInicial(String(resLoc[0].idLocal));
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar catálogo de produtos.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const limparForm = () => {
    setIdEditando(null);
    setSku("");
    setEan("");
    setNcm("54011012");
    setCfopPadrao("5102");
    setNome("");
    setDescricao("");
    setUnidMedida("UN");
    setPrecoPUnid("");
    setQtdMinimaVenda("1");
    setEstoqueMin("5");
    setIncluirLoteInicial(false);
    setQtdInicial("");
    setCustoInicial("");
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!nome || !precoPUnid || !idCateg) {
      alertaErro("Nome, Preço Unitário e Categoria são obrigatórios.");
      return;
    }

    try {
      const payload = {
        sku: sku || undefined,
        ean: ean || null,
        ncm,
        cfopPadrao,
        nome,
        descricao,
        idCateg: Number(idCateg),
        unidMedida,
        precoPUnid: Number(precoPUnid),
        qtdMinimaVenda: Number(qtdMinimaVenda || 1),
        estoqueMin: Number(estoqueMin || 0)
      };

      if (!idEditando && incluirLoteInicial && Number(qtdInicial) > 0) {
        payload.loteInicial = {
          quantidade: Number(qtdInicial),
          valorCompra: Number(custoInicial || Number(precoPUnid) * 0.5),
          idLocal: idLocalInicial ? Number(idLocalInicial) : undefined
        };
      }

      if (idEditando) {
        await api.put(`/produtos/${idEditando}`, payload);
        alertaSucesso("Produto atualizado com sucesso!");
      } else {
        const criado = await api.post("/produtos", payload);
        alertaSucesso(`Produto criado com sucesso! SKU gerado: ${criado.sku}`);
      }

      limparForm();
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao salvar produto.");
    }
  };

  const iniciarEdicao = (prod) => {
    setIdEditando(prod.idProd);
    setSku(prod.sku);
    setEan(prod.ean || "");
    setNcm(prod.ncm);
    setCfopPadrao(prod.cfopPadrao);
    setNome(prod.nome);
    setDescricao(prod.descricao || "");
    setIdCateg(String(prod.idCateg));
    setUnidMedida(prod.unidMedida);
    setPrecoPUnid(String(prod.precoPUnid));
    setQtdMinimaVenda(String(prod.qtdMinimaVenda));
    setEstoqueMin(String(prod.estoqueMin));
    setIncluirLoteInicial(false);
  };

  const handleConfirmarExclusao = async () => {
    if (!idExcluir) return;
    try {
      await api.delete(`/produtos/${idExcluir}`);
      alertaSucesso("Produto excluído com sucesso!");
      setIdExcluir(null);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao excluir produto.");
    }
  };

  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.sku.toLowerCase().includes(busca.toLowerCase()) ||
      (p.ean && p.ean.includes(busca));
    const matchCat = !filtroCategoria || String(p.idCateg) === filtroCategoria;
    return matchBusca && matchCat;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Gerenciamento de Produtos & Aviamentos</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Catálogo geral de artigos de armarinho com precificação, estoque mínimo e codificação padronizada.
        </p>
      </div>

      <div className="grid-4-8">
        {/* Coluna Formulário (4 colunas) */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Package size={20} color="#1D4ED8" />
            <h2>{idEditando ? "Editar Aviamento" : "Adicionar Produto"}</h2>
          </div>

          {isProprietario ? (
            <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>
                    Código SKU <TooltipInfo text="Se omitido, o sistema gerará o próximo número sequencial livre a partir de 1000." />
                  </span>
                  <input
                    type="text"
                    className="mono"
                    placeholder="Auto (>= 1000)"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </label>
                <label>
                  <span>Código EAN-13</span>
                  <input
                    type="text"
                    className="mono"
                    placeholder="789..."
                    value={ean}
                    onChange={(e) => setEan(e.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>
                  Nome / Descrição Comercial <span className="req-asterisk">*</span>
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Linha de Costura 100% Poliéster Branca"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>
                    Categoria <span className="req-asterisk">*</span>
                  </span>
                  <select required value={idCateg} onChange={(e) => setIdCateg(e.target.value)}>
                    <option value="">Selecione...</option>
                    {categorias.map((c) => (
                      <option key={c.idCateg} value={c.idCateg}>
                        {c.codigoHierarquico ? `[${c.codigoHierarquico}] ` : ""}{c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    Unidade <span className="req-asterisk">*</span>
                  </span>
                  <select value={unidMedida} onChange={(e) => setUnidMedida(e.target.value)}>
                    <option value="UN">UN (Unidade)</option>
                    <option value="CONE">CONE (Carretel/Cone)</option>
                    <option value="ROLO">ROLO (Fita/Elástico)</option>
                    <option value="PACOTE">PACOTE (Agulhas/Botões)</option>
                    <option value="METRO">METRO (Tecido/Renda)</option>
                    <option value="GROSA">GROSA (144 un)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>
                    Preço Unitário (R$) <span className="req-asterisk">*</span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="mono"
                    placeholder="0.00"
                    value={precoPUnid}
                    onChange={(e) => setPrecoPUnid(e.target.value)}
                  />
                </label>
                <label>
                  <span>
                    Qtd Mínima Venda <TooltipInfo text="Quantidade mínima exigida ao adicionar no pedido presencial de balcão." />
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="mono"
                    value={qtdMinimaVenda}
                    onChange={(e) => setQtdMinimaVenda(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>
                    Estoque Mínimo <TooltipInfo text="Patamar crítico que dispara o Alerta Automático para reposição preventiva." />
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="mono"
                    value={estoqueMin}
                    onChange={(e) => setEstoqueMin(e.target.value)}
                  />
                </label>
                <label>
                  <span>NCM Fiscal (8 dígitos)</span>
                  <input
                    type="text"
                    className="mono"
                    maxLength={8}
                    value={ncm}
                    onChange={(e) => setNcm(e.target.value)}
                  />
                </label>
              </div>

              {/* Seção de abertura de lote inicial (Apenas na criação) */}
              {!idEditando && (
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "10px", marginTop: "4px" }}>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                    <input
                      type="checkbox"
                      checked={incluirLoteInicial}
                      onChange={(e) => setIncluirLoteInicial(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px" }}>Cadastrar com Lote Inicial de Estoque</span>
                  </label>

                  {incluirLoteInicial && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", backgroundColor: "#F8FAFC", padding: "10px", borderRadius: "6px" }}>
                      <label>
                        <span>Quantidade Inicial</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ex: 50"
                          value={qtdInicial}
                          onChange={(e) => setQtdInicial(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Custo Unitário (R$)</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={custoInicial}
                          onChange={(e) => setCustoInicial(e.target.value)}
                        />
                      </label>
                      <label style={{ gridColumn: "span 2" }}>
                        <span>Gaveteiro / Local Físico</span>
                        <select value={idLocalInicial} onChange={(e) => setIdLocalInicial(e.target.value)}>
                          {locais.map((l) => (
                            <option key={l.idLocal} value={l.idLocal}>
                              {l.codigo} — {l.descricao}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={16} />
                  <span>{idEditando ? "Salvar Alterações" : "Salvar Produto"}</span>
                </button>
                {idEditando && (
                  <button type="button" className="btn btn-secondary" onClick={limparForm}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div style={{ padding: "20px", color: "#64748B", fontSize: "13px" }}>
              Acesso exclusivo para <strong>PROPRIETARIO</strong>. Operadores de balcão podem consultar o catálogo à direita.
            </div>
          )}
        </div>

        {/* Coluna Listagem (8 colunas) */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h2>Catálogo de Aviamentos ({produtosFiltrados.length})</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={{ height: "36px", fontSize: "13px" }}
              >
                <option value="">Todas as Categorias</option>
                {categorias.map((c) => (
                  <option key={c.idCateg} value={c.idCateg}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <div style={{ position: "relative", width: "220px" }}>
                <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
                <input
                  type="text"
                  placeholder="Pesquisar produto ou SKU..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ width: "100%", paddingLeft: "32px", height: "36px" }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {produtosFiltrados.map((p) => (
              <div
                key={p.idProd}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  padding: "14px",
                  backgroundColor: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                    <span className="mono" style={{ fontSize: "12px", fontWeight: "700", color: "#1D4ED8" }}>
                      SKU {p.sku}
                    </span>
                    <Badge variant={p.estoqueAtual === 0 ? "danger" : p.emAlertaMinimo ? "warning" : "success"}>
                      {p.estoqueAtual === 0 ? "Em Falta" : p.emAlertaMinimo ? "Alerta Mínimo" : "Disponível"}
                    </Badge>
                  </div>
                  <strong style={{ fontSize: "14px", display: "block", marginTop: "4px" }}>
                    {p.nome}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    {p.categoria?.nome || "-"}
                  </span>
                </div>

                <div style={{ backgroundColor: "#F8FAFC", padding: "8px", borderRadius: "4px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Preço Base:</span>
                    <strong className="mono">{formatarMoeda(p.precoPUnid)} / {p.unidMedida}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                    <span>Saldo Físico Total:</span>
                    <strong className="mono">{p.estoqueAtual} {p.unidMedida}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                    <span>Saldo Livre Vendável:</span>
                    <strong className="mono" style={{ color: "#166534" }}>{p.saldoLivre} {p.unidMedida}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#64748B" }}>
                    <span>Estoque Mínimo:</span>
                    <span className="mono">{p.estoqueMin} {p.unidMedida}</span>
                  </div>
                </div>

                {isProprietario && (
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => iniciarEdicao(p)}
                      title="Editar Produto"
                    >
                      <Edit2 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: "#DC2626" }}
                      onClick={() => {
                        setIdExcluir(p.idProd);
                        setModalExcluirOpen(true);
                      }}
                      title="Excluir Produto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalExcluirOpen}
        onClose={() => setModalExcluirOpen(false)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Produto"
        message="Atenção: A exclusão física só é permitida caso o produto não possua saldo em estoque nem histórico de movimentações, ordens de compra ou vendas. Se possuir histórico, inative-o. Deseja prosseguir?"
        confirmLabel="Sim, Excluir"
      />
    </div>
  );
}
