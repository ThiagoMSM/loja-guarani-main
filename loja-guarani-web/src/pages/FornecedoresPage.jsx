import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarCNPJ, formatarMoeda, validarCNPJ, mascaraCNPJ, limparDigitos } from "../utils/formatters";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import { Truck, Plus, Edit2, Search, Link2, Trash2 } from "lucide-react";

export function FornecedoresPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();

  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idEditando, setIdEditando] = useState(null);
  const [cnpj, setCnpj] = useState("");
  const [razSocial, setRazSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [contatoPrincipal, setContatoPrincipal] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [condicoesPagtoPadrao, setCondicoesPagtoPadrao] = useState("28/56 dias boleto");
  const [prazoMedioDias, setPrazoMedioDias] = useState("5");
  const [status, setStatus] = useState("ATIVO");

  // Modal Vínculo de Produtos (produto_fornecedor)
  const [modalVinculoOpen, setModalVinculoOpen] = useState(false);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState(null);
  const [idProdVincular, setIdProdVincular] = useState("");
  const [custoAcordado, setCustoAcordado] = useState("");
  const [leadTime, setLeadTime] = useState("7");

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resForn, resProd] = await Promise.all([api.get("/fornecedores"), api.get("/produtos")]);
      setFornecedores(resForn);
      setProdutos(resProd);
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar fornecedores.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const limparForm = () => {
    setIdEditando(null);
    setCnpj("");
    setRazSocial("");
    setNomeFantasia("");
    setContatoPrincipal("");
    setTelefone("");
    setEmail("");
    setEndereco("");
    setCondicoesPagtoPadrao("28/56 dias boleto");
    setPrazoMedioDias("5");
    setStatus("ATIVO");
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!cnpj || !razSocial) {
      alertaErro("CNPJ e Razão Social são obrigatórios.");
      return;
    }

    if (!validarCNPJ(cnpj)) {
      alertaErro("CNPJ informado possui dígitos verificadores inválidos.");
      return;
    }

    try {
      const payload = {
        cnpj,
        razSocial,
        nomeFantasia,
        contatoPrincipal,
        telefone,
        email,
        endereco,
        condicoesPagtoPadrao,
        prazoMedioDias: Number(prazoMedioDias || 5),
        status
      };

      if (idEditando) {
        await api.put(`/fornecedores/${idEditando}`, payload);
        alertaSucesso("Fornecedor atualizado com sucesso!");
      } else {
        await api.post("/fornecedores", payload);
        alertaSucesso("Fornecedor cadastrado com sucesso!");
      }

      limparForm();
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao salvar fornecedor.");
    }
  };

  const iniciarEdicao = (f) => {
    setIdEditando(f.idFornec);
    setCnpj(mascaraCNPJ(f.cnpj));
    setRazSocial(f.razSocial);
    setNomeFantasia(f.nomeFantasia || "");
    setContatoPrincipal(f.contatoPrincipal || "");
    setTelefone(f.telefone || "");
    setEmail(f.email || "");
    setEndereco(f.endereco || "");
    setCondicoesPagtoPadrao(f.condicoesPagtoPadrao || "28/56 dias boleto");
    setPrazoMedioDias(String(f.prazoMedioDias || 5));
    setStatus(f.status);
  };

  const abrirModalVinculo = (f) => {
    setFornecedorSelecionado(f);
    setIdProdVincular(produtos.length > 0 ? String(produtos[0].idProd) : "");
    setCustoAcordado("");
    setLeadTime(String(f.prazoMedioDias || 7));
    setModalVinculoOpen(true);
  };

  const handleSalvarVinculo = async (e) => {
    e.preventDefault();
    if (!idProdVincular) return;

    try {
      await api.post(`/fornecedores/${fornecedorSelecionado.idFornec}/produtos`, {
        idProd: Number(idProdVincular),
        precoCustoAcordado: custoAcordado ? Number(custoAcordado) : undefined,
        leadTimeDias: Number(leadTime || 7)
      });
      alertaSucesso("Produto vinculado ao fornecedor com sucesso!");
      const fornAtualizado = await api.get(`/fornecedores/${fornecedorSelecionado.idFornec}`);
      setFornecedorSelecionado(fornAtualizado);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao vincular produto.");
    }
  };

  const handleRemoverVinculo = async (idProd) => {
    try {
      await api.delete(`/fornecedores/${fornecedorSelecionado.idFornec}/produtos/${idProd}`);
      alertaSucesso("Vínculo removido com sucesso!");
      const fornAtualizado = await api.get(`/fornecedores/${fornecedorSelecionado.idFornec}`);
      setFornecedorSelecionado(fornAtualizado);
      carregarDados();
    } catch (err) {
      alertaErro(err.message || "Erro ao remover vínculo.");
    }
  };

  const fornecedoresFiltrados = fornecedores.filter(
    (f) =>
      f.razSocial.toLowerCase().includes(busca.toLowerCase()) ||
      (f.nomeFantasia && f.nomeFantasia.toLowerCase().includes(busca.toLowerCase())) ||
      f.cnpj.includes(busca) ||
      (limparDigitos(busca) && limparDigitos(f.cnpj).includes(limparDigitos(busca)))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Gerenciamento de Fornecedores</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Cadastro oficial de parceiros comerciais, distribuidores nacionais e tabela de custos pactuados.
        </p>
      </div>

      <div className="grid-4-8">
        {/* Formulário (4 colunas) */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Truck size={20} color="#1D4ED8" />
            <h2>{idEditando ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
          </div>

          {isProprietario ? (
            <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label>
                <span>
                  CNPJ (14 dígitos) <span className="req-asterisk">*</span>
                </span>
                <input
                  type="text"
                  required
                  className="mono"
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  value={cnpj}
                  onChange={(e) => setCnpj(mascaraCNPJ(e.target.value))}
                />
              </label>

              <label>
                <span>
                  Razão Social <span className="req-asterisk">*</span>
                </span>
                <input
                  type="text"
                  required
                  placeholder="Denominação empresarial"
                  value={razSocial}
                  onChange={(e) => setRazSocial(e.target.value)}
                />
              </label>

              <label>
                <span>Nome Fantasia / Comercial</span>
                <input
                  type="text"
                  placeholder="Ex: Linhas Corrente"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>Representante Comercial</span>
                  <input
                    type="text"
                    placeholder="Nome do contato"
                    value={contatoPrincipal}
                    onChange={(e) => setContatoPrincipal(e.target.value)}
                  />
                </label>
                <label>
                  <span>Telefone / WhatsApp</span>
                  <input
                    type="text"
                    placeholder="(11) 0000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>E-mail para Pedidos</span>
                <input
                  type="email"
                  placeholder="pedidos@fornecedor.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label>
                  <span>Condições de Pagamento</span>
                  <input
                    type="text"
                    placeholder="Ex: 28/56 dias boleto"
                    value={condicoesPagtoPadrao}
                    onChange={(e) => setCondicoesPagtoPadrao(e.target.value)}
                  />
                </label>
                <label>
                  <span>Prazo Médio (Dias)</span>
                  <input
                    type="number"
                    min="1"
                    className="mono"
                    value={prazoMedioDias}
                    onChange={(e) => setPrazoMedioDias(e.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>Status do Fornecedor</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ATIVO">ATIVO (Apto para Ordens de Compra)</option>
                  <option value="INATIVO">INATIVO (Bloqueado p/ novas OCs)</option>
                </select>
              </label>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={16} />
                  <span>{idEditando ? "Salvar Alterações" : "Cadastrar Fornecedor"}</span>
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
              Acesso exclusivo para <strong>PROPRIETARIO</strong>.
            </div>
          )}
        </div>

        {/* Listagem (8 colunas) */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h2>Fornecedores Cadastrados ({fornecedoresFiltrados.length})</h2>
            <div style={{ position: "relative", width: "240px" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              <input
                type="text"
                placeholder="Pesquisar fornecedor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: "32px", height: "36px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {fornecedoresFiltrados.map((f) => (
              <div
                key={f.idFornec}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  padding: "14px",
                  backgroundColor: f.status === "INATIVO" ? "#F8FAFC" : "#FFFFFF",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "12px"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "15px" }}>{f.razSocial}</strong>
                    {f.nomeFantasia && (
                      <span style={{ fontSize: "13px", color: "#64748B" }}>({f.nomeFantasia})</span>
                    )}
                    <Badge variant={f.status === "ATIVO" ? "success" : "danger"}>{f.status}</Badge>
                  </div>
                  <div className="mono" style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                    CNPJ: {formatarCNPJ(f.cnpj)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                    Contato: <strong>{f.contatoPrincipal || "Não informado"}</strong> | Tel: {f.telefone || "-"} | E-mail: {f.email || "-"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#1D4ED8", marginTop: "2px" }}>
                    Condições: {f.condicoesPagtoPadrao || "Padrão"} | Prazo médio: {f.prazoMedioDias} dias úteis
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => abrirModalVinculo(f)}
                    title="Vincular Produtos / Tabela de Preços"
                  >
                    <Link2 size={14} />
                    <span>Portfólio ({f.produtosFornecidos?.length || 0})</span>
                  </button>
                  {isProprietario && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => iniciarEdicao(f)}
                      title="Editar Fornecedor"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Vínculo de Portfólio de Produtos */}
      <Modal
        isOpen={modalVinculoOpen}
        onClose={() => setModalVinculoOpen(false)}
        title={`Portfólio de Produtos — ${fornecedorSelecionado?.nomeFantasia || fornecedorSelecionado?.razSocial || ""}`}
        maxWidth="680px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Adicionar Vínculo */}
          {isProprietario && (
            <form onSubmit={handleSalvarVinculo} style={{ backgroundColor: "#F8FAFC", padding: "14px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
              <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Vincular Aviamento ao Fornecedor:
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "8px", alignItems: "flex-end" }}>
                <label>
                  <span>Produto</span>
                  <select value={idProdVincular} onChange={(e) => setIdProdVincular(e.target.value)}>
                    {produtos.map((p) => (
                      <option key={p.idProd} value={p.idProd}>
                        SKU {p.sku} — {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Preço Custo (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={custoAcordado}
                    onChange={(e) => setCustoAcordado(e.target.value)}
                  />
                </label>
                <label>
                  <span>Prazo (dias)</span>
                  <input
                    type="number"
                    min="1"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn btn-primary btn-sm" style={{ height: "40px" }}>
                  Vincular
                </button>
              </div>
            </form>
          )}

          {/* Lista de Vínculos Atuais */}
          <div>
            <h4 style={{ fontSize: "13px", marginBottom: "8px" }}>Produtos Fornecidos por este Parceiro:</h4>
            {fornecedorSelecionado?.produtosFornecidos?.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic" }}>
                Nenhum produto vinculado ainda.
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Produto</th>
                      <th>Custo Acordado</th>
                      <th>Prazo Médio</th>
                      {isProprietario && <th style={{ textAlign: "right" }}>Ação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedorSelecionado?.produtosFornecidos?.map((pf) => (
                      <tr key={pf.idProd}>
                        <td className="mono" style={{ color: "#1D4ED8", fontWeight: "600" }}>
                          {pf.produto.sku}
                        </td>
                        <td>{pf.produto.nome}</td>
                        <td className="mono">
                          {pf.precoCustoAcordado ? formatarMoeda(pf.precoCustoAcordado) : "-"}
                        </td>
                        <td className="mono">{pf.leadTimeDias} dias</td>
                        {isProprietario && (
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#DC2626", height: "28px", padding: "0 6px" }}
                              onClick={() => handleRemoverVinculo(pf.idProd)}
                              title="Remover Vínculo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
