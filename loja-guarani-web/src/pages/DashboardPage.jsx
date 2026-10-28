import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda } from "../utils/formatters";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import {
  Package,
  DollarSign,
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Search,
  ShoppingCart,
  PlusCircle,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock
} from "lucide-react";

export function DashboardPage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro, recarregarAlertas } = useToast();
  const navigate = useNavigate();

  const [resumo, setResumo] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [runtimeConfig, setRuntimeConfig] = useState({ enforceBusinessHours: false, simularFalhaSatGlobal: false });
  const [carregando, setCarregando] = useState(true);

  // Modal Usuários
  const [modalUsuariosOpen, setModalUsuariosOpen] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", emailLogin: "", senha: "", perfil: "VENDEDOR", cpf: "" });
  const [idUsuarioReset, setIdUsuarioReset] = useState(null);
  const [novaSenhaReset, setNovaSenhaReset] = useState("");

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resResumo, resAlertas, resConfig] = await Promise.all([
        api.get("/dashboard/resumo"),
        api.get("/alertas"),
        api.get("/config/runtime")
      ]);
      setResumo(resResumo);
      setAlertas(resAlertas);
      setRuntimeConfig(resConfig);
      recarregarAlertas();
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar dados do painel.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleToggleHorario = async () => {
    try {
      const novoValor = !runtimeConfig.enforceBusinessHours;
      const res = await api.patch("/config/runtime", { enforceBusinessHours: novoValor });
      setRuntimeConfig(res.config);
      alertaSucesso(
        novoValor
          ? "Restrição de Horário Comercial (10h-18h) ATIVADA com sucesso!"
          : "Restrição de Horário Comercial DESATIVADA (Acesso livre para testes/apresentação)."
      );
    } catch (err) {
      alertaErro(err.message || "Erro ao alterar restrição de horário.");
    }
  };

  const handleToggleFalhaSat = async () => {
    try {
      const novoValor = !runtimeConfig.simularFalhaSatGlobal;
      const res = await api.patch("/config/runtime", { simularFalhaSatGlobal: novoValor });
      setRuntimeConfig(res.config);
      alertaSucesso(
        novoValor
          ? "Simulação de Falha SAT Global ATIVADA (Testará Rollback ACID em todas as vendas)."
          : "Simulação de Falha SAT Global DESATIVADA (Operação normal)."
      );
    } catch (err) {
      alertaErro(err.message || "Erro ao alterar simulação SAT.");
    }
  };

  // Funções de Usuários
  const abrirModalUsuarios = async () => {
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res);
      setModalUsuariosOpen(true);
    } catch (err) {
      alertaErro(err.message || "Erro ao listar usuários.");
    }
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    try {
      await api.post("/usuarios", novoUsuario);
      alertaSucesso("Usuário criado com sucesso!");
      setNovoUsuario({ nome: "", emailLogin: "", senha: "", perfil: "VENDEDOR", cpf: "" });
      const res = await api.get("/usuarios");
      setUsuarios(res);
    } catch (err) {
      alertaErro(err.message || "Erro ao criar usuário.");
    }
  };

  const handleResetSenha = async (idUsuario) => {
    if (!novaSenhaReset || novaSenhaReset.length < 6) {
      alertaErro("Informe uma senha com no mínimo 6 caracteres.");
      return;
    }
    try {
      await api.patch(`/usuarios/${idUsuario}/reset-senha`, { novaSenha: novaSenhaReset });
      alertaSucesso("Senha redefinida e conta desbloqueada com sucesso!");
      setIdUsuarioReset(null);
      setNovaSenhaReset("");
      const res = await api.get("/usuarios");
      setUsuarios(res);
    } catch (err) {
      alertaErro(err.message || "Erro ao resetar senha.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Cabeçalho da Página */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Painel Principal & Alertas</h1>
          <p style={{ color: "#64748B", fontSize: "14px" }}>
            Visão consolidada em tempo real da operação da Loja Guarani.
          </p>
        </div>

        {/* Atalhos Rápidos */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => navigate("/balcao")}>
            <ClipboardList size={16} />
            <span>Novo Pedido no Balcão (F2)</span>
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/caixa")}>
            <ShoppingCart size={16} />
            <span>Caixa & Venda SAT</span>
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/consulta-estoque")}>
            <Search size={16} />
            <span>Consultar Estoque (F3)</span>
          </button>
          {isProprietario && (
            <button className="btn btn-secondary" onClick={abrirModalUsuarios}>
              <Users size={16} />
              <span>Gerenciar Usuários</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Cards de Resumo Executivo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {/* Card 1: SKUs Ativos */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ backgroundColor: "#E0F2FE", padding: "12px", borderRadius: "8px", color: "#0284C7" }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", textTransform: "uppercase" }}>
              Total de SKUs Ativos
            </div>
            <div className="mono" style={{ fontSize: "24px", fontWeight: "700" }}>
              {resumo?.totalSkusAtivos || 0}
            </div>
          </div>
        </div>

        {/* Card 2: Vendas do Dia */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ backgroundColor: "#DCFCE7", padding: "12px", borderRadius: "8px", color: "#16A34A" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", textTransform: "uppercase" }}>
              Vendas no Dia (R$)
            </div>
            <div className="mono" style={{ fontSize: "22px", fontWeight: "700", color: "#166534" }}>
              {formatarMoeda(resumo?.vendasHoje?.valorTotal || 0)}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>
              {resumo?.vendasHoje?.quantidade || 0} venda(s) confirmada(s)
            </div>
          </div>
        </div>

        {/* Card 3: Alertas de Estoque Mínimo */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              backgroundColor: resumo?.produtosAbaixoMinimo > 0 ? "#FEE2E2" : "#FEF3C7",
              padding: "12px",
              borderRadius: "8px",
              color: resumo?.produtosAbaixoMinimo > 0 ? "#DC2626" : "#D97706"
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", textTransform: "uppercase" }}>
              Abaixo do Mínimo
            </div>
            <div className="mono" style={{ fontSize: "24px", fontWeight: "700", color: resumo?.produtosAbaixoMinimo > 0 ? "#DC2626" : "#0F172A" }}>
              {resumo?.produtosAbaixoMinimo || 0}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Demanda reposição</div>
          </div>
        </div>

        {/* Card 4: Lotes Críticos / Vencimento */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ backgroundColor: "#FEF3C7", padding: "12px", borderRadius: "8px", color: "#D97706" }}>
            <CalendarClock size={24} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", textTransform: "uppercase" }}>
              Lotes Críticos (&lt; 30d)
            </div>
            <div className="mono" style={{ fontSize: "24px", fontWeight: "700", color: "#D97706" }}>
              {resumo?.lotesCriticosValidade || 0}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Perecíveis / Vencidos</div>
          </div>
        </div>
      </div>

      {/* Seção de Governança e Configurações em Tempo Real (Apenas Proprietário) */}
      {isProprietario && (
        <div className="card" style={{ backgroundColor: "#F8FAFC", border: "1px solid #CBD5E1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <ShieldCheck size={18} color="#1D4ED8" />
            <h3 style={{ fontSize: "15px" }}>Controles de Governança & Demonstração (Proprietário)</h3>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
            {/* Toggle Trava de Horário Comercial */}
            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={runtimeConfig.enforceBusinessHours}
                onChange={handleToggleHorario}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "13px", color: "#1E293B" }}>
                <strong>Trava de Horário Comercial (10h às 18h p/ Vendedor)</strong>{" "}
                <span style={{ color: runtimeConfig.enforceBusinessHours ? "#16A34A" : "#64748B" }}>
                  [{runtimeConfig.enforceBusinessHours ? "ATIVADO" : "DESATIVADO (Livre p/ testes)"}]
                </span>
              </span>
            </label>

            {/* Toggle Simulação Falha SAT */}
            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={runtimeConfig.simularFalhaSatGlobal}
                onChange={handleToggleFalhaSat}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "13px", color: "#1E293B" }}>
                <strong>Simular Falha Global SAT (Teste E3 Rollback ACID)</strong>{" "}
                <span style={{ color: runtimeConfig.simularFalhaSatGlobal ? "#DC2626" : "#64748B" }}>
                  [{runtimeConfig.simularFalhaSatGlobal ? "FALHA ATIVADA" : "NORMAL"}]
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Tabela de Alertas Ativos de Estoque Mínimo */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={20} color="#DC2626" />
            <h2>Alertas Automáticos de Estoque Mínimo</h2>
          </div>
          <span style={{ fontSize: "13px", color: "#64748B" }}>
            {alertas.length} produto(s) demandando ressuprimento
          </span>
        </div>

        {alertas.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#166534", backgroundColor: "#DCFCE7", borderRadius: "6px" }}>
            <CheckCircle2 size={32} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontWeight: "600" }}>Todos os produtos estão com níveis de estoque saudáveis!</p>
            <span style={{ fontSize: "13px" }}>Nenhum aviamento com saldo atual menor ou igual ao estoque mínimo.</span>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Criticidade</th>
                  <th>SKU</th>
                  <th>Aviamento / Produto</th>
                  <th>Categoria</th>
                  <th>Locais Físicos</th>
                  <th>Saldo Atual</th>
                  <th>Estoque Mínimo</th>
                  <th>Fornecedor Sugerido</th>
                  <th>Status Reposição</th>
                  <th style={{ textAlign: "right" }}>Ação Preventiva</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((alerta) => (
                  <tr key={alerta.idProd}>
                    <td>
                      <Badge variant={alerta.criticidade === "CRITICO" ? "danger" : "warning"}>
                        {alerta.criticidade}
                      </Badge>
                    </td>
                    <td className="mono" style={{ fontWeight: "600" }}>
                      {alerta.sku}
                    </td>
                    <td>
                      <strong>{alerta.nome}</strong>
                    </td>
                    <td>{alerta.categoriaNome}</td>
                    <td>
                      <span className="mono" style={{ fontSize: "12px", color: "#475569" }}>
                        {alerta.locaisFisicos}
                      </span>
                    </td>
                    <td className="mono" style={{ fontWeight: "700", color: alerta.estoqueAtual === 0 ? "#DC2626" : "#D97706" }}>
                      {alerta.estoqueAtual} {alerta.unidMedida}
                    </td>
                    <td className="mono" style={{ color: "#64748B" }}>
                      {alerta.estoqueMin} {alerta.unidMedida}
                    </td>
                    <td>
                      {alerta.fornecedorPreferencial ? (
                        <span>{alerta.fornecedorPreferencial.nomeFantasia || alerta.fornecedorPreferencial.nome}</span>
                      ) : (
                        <span style={{ color: "#DC2626", fontStyle: "italic", fontSize: "12px" }}>
                          Sem fornecedor vinculado
                        </span>
                      )}
                    </td>
                    <td>
                      {alerta.statusAlerta === "EM_REPOSICAO" ? (
                        <Badge variant="info">Em Reposição (OC #{alerta.idOcAberta})</Badge>
                      ) : (
                        <Badge variant="warning">Pendente de Compra</Badge>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {isProprietario ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const fornecParam = alerta.fornecedorPreferencial ? `&idFornec=${alerta.fornecedorPreferencial.idFornec}` : "";
                            navigate(
                              `/ordens-compra?novo=1&idProd=${alerta.idProd}&qtd=${alerta.quantidadeSugerida}${fornecParam}`
                            );
                          }}
                        >
                          <PlusCircle size={14} />
                          <span>Gerar OC</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94A3B8" }}>Apenas Proprietário</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Gestão de Usuários */}
      <Modal
        isOpen={modalUsuariosOpen}
        onClose={() => setModalUsuariosOpen(false)}
        title="Gerenciamento de Usuários & Controle de Acesso"
        maxWidth="750px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Formulário Novo Usuário */}
          <form onSubmit={handleCriarUsuario} style={{ backgroundColor: "#F8FAFC", padding: "16px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "12px" }}>Cadastrar Novo Usuário</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                <span>Nome Completo <span className="req-asterisk">*</span></span>
                <input
                  type="text"
                  required
                  value={novoUsuario.nome}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                  placeholder="Nome do colaborador"
                />
              </label>
              <label>
                <span>E-mail / Login <span className="req-asterisk">*</span></span>
                <input
                  type="email"
                  required
                  value={novoUsuario.emailLogin}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, emailLogin: e.target.value })}
                  placeholder="colaborador@lojaguarani.com.br"
                />
              </label>
              <label>
                <span>Senha Inicial <span className="req-asterisk">*</span></span>
                <input
                  type="password"
                  required
                  value={novoUsuario.senha}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
              <label>
                <span>Perfil de Acesso <span className="req-asterisk">*</span></span>
                <select
                  value={novoUsuario.perfil}
                  onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value })}
                >
                  <option value="VENDEDOR">VENDEDOR (Balcão / Caixa / Consultas)</option>
                  <option value="PROPRIETARIO">PROPRIETARIO (Acesso Total)</option>
                </select>
              </label>
              {novoUsuario.perfil === "VENDEDOR" && (
                <label style={{ gridColumn: "span 2" }}>
                  <span>CPF do Vendedor <span className="req-asterisk">*</span></span>
                  <input
                    type="text"
                    required
                    value={novoUsuario.cpf}
                    onChange={(e) => setNovoUsuario({ ...novoUsuario, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </label>
              )}
            </div>
            <div style={{ marginTop: "12px", textAlign: "right" }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Salvar Novo Usuário
              </button>
            </div>
          </form>

          {/* Lista de Usuários */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Falhas</th>
                  <th>Último Acesso</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.idUsuario}>
                    <td><strong>{u.nome}</strong></td>
                    <td className="mono">{u.emailLogin}</td>
                    <td>
                      <Badge variant={u.perfil === "PROPRIETARIO" ? "info" : "neutral"}>
                        {u.perfil}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={u.status === "ATIVO" ? "success" : u.status === "BLOQUEADO" ? "danger" : "neutral"}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="mono">{u.tentativasFalhas}</td>
                    <td style={{ fontSize: "12px", color: "#64748B" }}>
                      {u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleString("pt-BR") : "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {idUsuarioReset === u.idUsuario ? (
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <input
                            type="password"
                            placeholder="Nova senha"
                            value={novaSenhaReset}
                            onChange={(e) => setNovaSenhaReset(e.target.value)}
                            style={{ height: "30px", width: "120px", fontSize: "12px" }}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ height: "30px", padding: "0 8px" }}
                            onClick={() => handleResetSenha(u.idUsuario)}
                          >
                            OK
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ height: "30px", padding: "0 8px" }}
                            onClick={() => setIdUsuarioReset(null)}
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ height: "30px", fontSize: "12px" }}
                          onClick={() => {
                            setIdUsuarioReset(u.idUsuario);
                            setNovaSenhaReset("");
                          }}
                        >
                          Redefinir Senha
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
