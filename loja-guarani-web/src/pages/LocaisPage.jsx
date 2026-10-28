import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { Badge } from "../components/Badge";
import { MapPin, Plus, Edit2, Ban, Search } from "lucide-react";

export function LocaisPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();

  const [locais, setLocais] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idEditando, setIdEditando] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [tipoCompartimento, setTipoCompartimento] = useState("GAVETEIRO");
  const [capacidade, setCapacidade] = useState("200");
  const [descricao, setDescricao] = useState("");

  // Modal Inativação
  const [modalInativarOpen, setModalInativarOpen] = useState(false);
  const [idInativar, setIdInativar] = useState(null);

  const carregarLocais = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/locais");
      setLocais(res);
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar locais físicos.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarLocais();
  }, []);

  const limparForm = () => {
    setIdEditando(null);
    setCodigo("");
    setTipoCompartimento("GAVETEIRO");
    setCapacidade("200");
    setDescricao("");
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!codigo || !capacidade) {
      alertaErro("Código e capacidade máxima são obrigatórios.");
      return;
    }

    try {
      const payload = {
        codigo,
        tipoCompartimento,
        capacidade: Number(capacidade),
        descricao
      };

      if (idEditando) {
        await api.put(`/locais/${idEditando}`, payload);
        alertaSucesso("Local físico atualizado com sucesso!");
      } else {
        await api.post("/locais", payload);
        alertaSucesso("Local físico cadastrado com sucesso!");
      }

      limparForm();
      carregarLocais();
    } catch (err) {
      alertaErro(err.message || "Erro ao salvar local.");
    }
  };

  const iniciarEdicao = (loc) => {
    setIdEditando(loc.idLocal);
    setCodigo(loc.codigo);
    setTipoCompartimento(loc.tipoCompartimento || "GAVETEIRO");
    setCapacidade(String(loc.capacidade));
    setDescricao(loc.descricao || "");
  };

  const handleConfirmarInativacao = async () => {
    if (!idInativar) return;
    try {
      await api.patch(`/locais/${idInativar}/inativar`);
      alertaSucesso("Local físico inativado com sucesso!");
      setIdInativar(null);
      carregarLocais();
    } catch (err) {
      alertaErro(err.message || "Erro ao inativar local.");
    }
  };

  const locaisFiltrados = locais.filter(
    (l) =>
      l.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      (l.descricao && l.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Gerenciamento de Locais Físicos de Armazenamento</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Mapeamento dos gaveteiros, prateleiras e estantes numeradas da loja da Rua Três Rios.
        </p>
      </div>

      <div className="grid-4-8">
        {/* Formulário (4 colunas) */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <MapPin size={20} color="#1D4ED8" />
            <h2>{idEditando ? "Editar Local Físico" : "Novo Endereço de Estoque"}</h2>
          </div>

          {isProprietario ? (
            <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label>
                <span>
                  Código do Local (Endereço Físico) <span className="req-asterisk">*</span>
                </span>
                <input
                  type="text"
                  required
                  className="mono"
                  placeholder="Ex: GAV-A-01, PRAT-B-04"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>

              <label>
                <span>
                  Tipo de Compartimento <span className="req-asterisk">*</span>
                </span>
                <select value={tipoCompartimento} onChange={(e) => setTipoCompartimento(e.target.value)}>
                  <option value="GAVETEIRO">GAVETEIRO (Miudezas, Linhas, Botões)</option>
                  <option value="PRATELEIRA">PRATELEIRA (Fitas, Zíperes)</option>
                  <option value="ESTANTE">ESTANTE (Rolos Grandes e Caixas)</option>
                  <option value="VITRINE">VITRINE (Amostras de Balcão)</option>
                  <option value="DEPOSITO">DEPÓSITO (Fundo da Loja)</option>
                </select>
              </label>

              <label>
                <span>
                  Capacidade Máxima (Unidades / Pacotes) <span className="req-asterisk">*</span>
                </span>
                <input
                  type="number"
                  min="1"
                  required
                  className="mono"
                  placeholder="Ex: 200"
                  value={capacidade}
                  onChange={(e) => setCapacidade(e.target.value)}
                />
              </label>

              <label>
                <span>Descrição da Localização</span>
                <textarea
                  placeholder="Ex: Balcão Principal — Gaveteiro A, Gaveta 01 (Linhas de Costura)"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={16} />
                  <span>{idEditando ? "Salvar Alterações" : "Cadastrar Local"}</span>
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

        {/* Listagem com Barras de Progresso de Ocupação (8 colunas) */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h2>Endereços Físicos Mapeados ({locaisFiltrados.length})</h2>
            <div style={{ position: "relative", width: "240px" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
              <input
                type="text"
                placeholder="Pesquisar gaveteiro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: "32px", height: "36px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {locaisFiltrados.map((loc) => {
              const corBarra =
                loc.percentualOcupacao >= 100
                  ? "#DC2626"
                  : loc.percentualOcupacao > 80
                  ? "#D97706"
                  : "#16A34A";

              return (
                <div
                  key={loc.idLocal}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "6px",
                    padding: "14px",
                    backgroundColor: loc.status === "INATIVO" ? "#F8FAFC" : "#FFFFFF"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="mono" style={{ fontSize: "14px", fontWeight: "700", color: "#1D4ED8" }}>
                          {loc.codigo}
                        </span>
                        <Badge variant="neutral">{loc.tipoCompartimento}</Badge>
                        {loc.status === "INATIVO" && <Badge variant="danger">INATIVO</Badge>}
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                        {loc.descricao || "Sem descrição"}
                      </div>
                    </div>

                    {isProprietario && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => iniciarEdicao(loc)}
                          title="Editar Local"
                        >
                          <Edit2 size={13} />
                        </button>
                        {loc.status === "ATIVO" && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: "#DC2626" }}
                            onClick={() => {
                              setIdInativar(loc.idLocal);
                              setModalInativarOpen(true);
                            }}
                            title="Inativar Local (Exige saldo zero)"
                          >
                            <Ban size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Barra de Progresso de Ocupação */}
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>
                        Ocupação: <strong className="mono">{loc.ocupacaoAtual} / {loc.capacidade} un</strong>
                      </span>
                      <span className="mono" style={{ color: corBarra, fontWeight: "600" }}>
                        {loc.percentualOcupacao}% ({loc.capacidadeLivre} un livres)
                      </span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${loc.percentualOcupacao}%`, backgroundColor: corBarra }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={modalInativarOpen}
        onClose={() => setModalInativarOpen(false)}
        onConfirm={handleConfirmarInativacao}
        title="Inativar Local Físico"
        message="Atenção: Um local físico só pode ser inativado se a soma das quantidades alocadas nele for igual a zero. Se houver produtos alocados, realize o remanejamento prévio. Deseja inativar?"
        confirmLabel="Sim, Inativar"
      />
    </div>
  );
}
