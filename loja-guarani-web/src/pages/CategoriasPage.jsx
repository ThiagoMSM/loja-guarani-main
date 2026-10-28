import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Modal } from "../components/Modal";
import { ConfirmModal } from "../components/ConfirmModal";
import { FolderTree, Plus, Search, Edit2, Trash2, Folder, Layers, Package } from "lucide-react";

export function CategoriasPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();

  const [categorias, setCategorias] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Form de criação/edição
  const [idEditando, setIdEditando] = useState(null);
  const [codigoHierarquico, setCodigoHierarquico] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [idCategPai, setIdCategPai] = useState("");

  // Modal de Detalhes / Inspeção
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
  const [categoriaDetalhe, setCategoriaDetalhe] = useState(null);

  // Modal de Exclusão
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [idExcluir, setIdExcluir] = useState(null);

  const carregarCategorias = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/categorias");
      setCategorias(res);
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar categorias.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarCategorias();
  }, []);

  const limparForm = () => {
    setIdEditando(null);
    setCodigoHierarquico("");
    setNome("");
    setDescricao("");
    setIdCategPai("");
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!nome) {
      alertaErro("Nome da categoria é obrigatório.");
      return;
    }

    try {
      const payload = {
        codigoHierarquico: codigoHierarquico || null,
        nome,
        descricao: descricao || null,
        idCategPai: idCategPai ? Number(idCategPai) : null
      };

      if (idEditando) {
        await api.put(`/categorias/${idEditando}`, payload);
        alertaSucesso("Categoria atualizada com sucesso!");
      } else {
        await api.post("/categorias", payload);
        alertaSucesso("Categoria cadastrada com sucesso!");
      }

      limparForm();
      carregarCategorias();
    } catch (err) {
      alertaErro(err.message || "Erro ao salvar categoria.");
    }
  };

  const iniciarEdicao = (cat) => {
    setIdEditando(cat.idCateg);
    setCodigoHierarquico(cat.codigoHierarquico || "");
    setNome(cat.nome);
    setDescricao(cat.descricao || "");
    setIdCategPai(cat.idCategPai ? String(cat.idCategPai) : "");
  };

  const abrirInspecao = async (cat) => {
    try {
      const detalhe = await api.get(`/categorias/${cat.idCateg}`);
      setCategoriaDetalhe(detalhe);
      setModalDetalhesOpen(true);
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar detalhes da categoria.");
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!idExcluir) return;
    try {
      await api.delete(`/categorias/${idExcluir}`);
      alertaSucesso("Categoria excluída com sucesso!");
      setIdExcluir(null);
      carregarCategorias();
    } catch (err) {
      alertaErro(err.message || "Erro ao excluir categoria.");
    }
  };

  // Filtragem da árvore
  const categoriasFiltradas = categorias.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.codigoHierarquico && c.codigoHierarquico.includes(busca))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Gerenciamento de Categorias & Subcategorias</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Organização em árvore mercadológica estruturada para os artigos de armarinho e aviamentos.
        </p>
      </div>

      <div className="grid-4-8">
        {/* Coluna 1 (4 colunas): Formulário de Inclusão / Edição */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <FolderTree size={20} color="#1D4ED8" />
            <h2>{idEditando ? "Editar Categoria" : "Nova Categoria"}</h2>
          </div>

          {isProprietario ? (
            <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label>
                <span>Código Hierárquico</span>
                <input
                  type="text"
                  className="mono"
                  placeholder="Ex: 1, 1.4, 1.4.6"
                  value={codigoHierarquico}
                  onChange={(e) => setCodigoHierarquico(e.target.value)}
                />
              </label>

              <label>
                <span>
                  Nome da Categoria <span className="req-asterisk">*</span>
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Linhas 100% Poliéster"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>

              <label>
                <span>Categoria Pai (Nível Superior)</span>
                <select value={idCategPai} onChange={(e) => setIdCategPai(e.target.value)}>
                  <option value="">Nenhuma (Categoria Raiz)</option>
                  {categorias
                    .filter((c) => !idEditando || c.idCateg !== idEditando)
                    .map((c) => (
                      <option key={c.idCateg} value={c.idCateg}>
                        {c.codigoHierarquico ? `[${c.codigoHierarquico}] ` : ""}
                        {c.nome}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>Descrição Complementar</span>
                <textarea
                  placeholder="Detalhamento sobre os artigos abrangidos..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={16} />
                  <span>{idEditando ? "Salvar Alterações" : "Adicionar Categoria"}</span>
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
              Apenas usuários com perfil <strong>PROPRIETARIO</strong> podem cadastrar ou editar categorias.
            </div>
          )}
        </div>

        {/* Coluna 2 (8 colunas): Listagem em Árvore Hierárquica */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h2>Estrutura Mercadológica</h2>
            <div style={{ position: "relative", width: "260px" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "12px" }} />
              <input
                type="text"
                placeholder="Pesquisar categoria..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: "32px", height: "36px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {categoriasFiltradas.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                Nenhuma categoria localizada.
              </div>
            ) : (
              categoriasFiltradas.map((cat) => {
                // Calcular recuo visual baseado no código hierárquico (ex: 1 = 0, 1.4 = 24px, 1.4.6 = 48px)
                const profundidade = cat.codigoHierarquico ? cat.codigoHierarquico.split(".").length - 1 : 0;
                const recuo = profundidade * 24;

                return (
                  <div
                    key={cat.idCateg}
                    style={{
                      marginLeft: `${recuo}px`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1px solid #E2E8F0",
                      backgroundColor: profundidade === 0 ? "#F8FAFC" : "#FFFFFF"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Folder size={18} color={profundidade === 0 ? "#1D4ED8" : "#64748B"} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {cat.codigoHierarquico && (
                            <span className="mono" style={{ fontSize: "12px", color: "#1D4ED8", fontWeight: "600" }}>
                              [{cat.codigoHierarquico}]
                            </span>
                          )}
                          <strong style={{ fontSize: "14px" }}>{cat.nome}</strong>
                        </div>
                        {cat.descricao && (
                          <div style={{ fontSize: "12px", color: "#64748B" }}>{cat.descricao}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                        {cat._count?.produtos || 0} produto(s)
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => abrirInspecao(cat)}
                        title="Inspecionar Subcategoria e Produtos"
                      >
                        <Layers size={14} />
                        <span>Inspecionar</span>
                      </button>
                      {isProprietario && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => iniciarEdicao(cat)}
                            title="Editar Categoria"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: "#DC2626" }}
                            onClick={() => {
                              setIdExcluir(cat.idCateg);
                              setModalExcluirOpen(true);
                            }}
                            title="Excluir Categoria"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal de Inspeção de Subcategoria (Figura 25) */}
      <Modal
        isOpen={modalDetalhesOpen}
        onClose={() => setModalDetalhesOpen(false)}
        title="Inspeção da Categoria / Subcategoria"
      >
        {categoriaDetalhe && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ backgroundColor: "#F8FAFC", padding: "14px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "13px", color: "#64748B" }}>
                <strong>Caminho Hierárquico:</strong>{" "}
                <span className="mono">{categoriaDetalhe.codigoHierarquico || "-"}</span>
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", marginTop: "4px" }}>
                {categoriaDetalhe.nome}
              </div>
              {categoriaDetalhe.categoriaPai && (
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  Subordinada a: <strong>{categoriaDetalhe.categoriaPai.nome}</strong>
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>Produtos Vinculados nesta Categoria:</h4>
              {categoriaDetalhe.produtos && categoriaDetalhe.produtos.length > 0 ? (
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                  {categoriaDetalhe.produtos.map((p) => (
                    <li key={p.idProd}>
                      <span className="mono" style={{ color: "#1D4ED8" }}>SKU {p.sku}</span> — {p.nome}{" "}
                      (Saldo: <strong>{p.estoqueAtual} {p.unidMedida}</strong>)
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic" }}>
                  Nenhum produto vinculado diretamente a esta categoria no momento.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={modalExcluirOpen}
        onClose={() => setModalExcluirOpen(false)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Categoria"
        message="Atenção: A categoria só poderá ser excluída se não possuir produtos nem subcategorias vinculadas. Deseja prosseguir?"
        confirmLabel="Sim, Excluir"
      />
    </div>
  );
}
