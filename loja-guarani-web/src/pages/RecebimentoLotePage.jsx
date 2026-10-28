import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarData } from "../utils/formatters";
import { TooltipInfo } from "../components/TooltipInfo";
import { PackageCheck, ArrowRight, Plus, Trash2 } from "lucide-react";

export function RecebimentoLotePage() {
  const { isProprietario } = useAuth();
  const { alertaSucesso, alertaErro } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ocs, setOcs] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Form State
  const [idOc, setIdOc] = useState(searchParams.get("idOc") || "");
  const [idProd, setIdProd] = useState(searchParams.get("idProd") || "");
  const [numeroNf, setNumeroNf] = useState("");
  const [numLote, setNumLote] = useState("");
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().slice(0, 10));
  const [dataFabricacao, setDataFabricacao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [quantidadeRecebida, setQuantidadeRecebida] = useState("");

  // Alocações Multi-Gaveteiro
  const [alocacoes, setAlocacoes] = useState([]);

  // Variável que indica se há uma OC vinculada
  const temOcVinculada = Boolean(idOc);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [resOcs, resProd, resLoc] = await Promise.all([
        api.get("/ordens-compra"),
        api.get("/produtos"),
        api.get("/locais?status=ATIVO")
      ]);

      const ocsPendentes = resOcs.filter(
        (o) => o.status === "AGUARDANDO_RECEBIMENTO" || o.status === "PARCIALMENTE_ATENDIDA"
      );
      setOcs(ocsPendentes);
      setProdutos(resProd);
      setLocais(resLoc);

      if (resLoc.length > 0 && alocacoes.length === 0) {
        setAlocacoes([{ idLocal: resLoc[0].idLocal, quantidade: "" }]);
      }

      // Se passou idProd via query param
      const prodParam = searchParams.get("idProd");
      if (prodParam) {
        setIdProd(String(prodParam));
      }

      // Se passou idOc via query param
      const ocParam = searchParams.get("idOc");
      if (ocParam) {
        const ocSelecionada = ocsPendentes.find((o) => o.idOc === Number(ocParam));
        if (ocSelecionada && ocSelecionada.itens.length > 0) {
          setIdOc(String(ocSelecionada.idOc));
          setIdProd(String(ocSelecionada.itens[0].idProd));
          if (ocSelecionada.dataEmissao) {
            setDataCompra(ocSelecionada.dataEmissao.slice(0, 10));
          }
          const restante = Math.max(0, ocSelecionada.itens[0].quantidadePedida - ocSelecionada.itens[0].quantidadeRecebida);
          setQuantidadeRecebida(String(restante));
          if (resLoc.length > 0) {
            setAlocacoes([{ idLocal: resLoc[0].idLocal, quantidade: String(restante) }]);
          }
        }
      }
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar dados de recebimento.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Sincroniza query params (idProd, idOc) caso mudem dinamicamente
  useEffect(() => {
    const prodParam = searchParams.get("idProd");
    const ocParam = searchParams.get("idOc");

    if (prodParam) {
      setIdProd(String(prodParam));
    }

    if (ocParam) {
      setIdOc(String(ocParam));
      const oc = ocs.find((o) => o.idOc === Number(ocParam));
      if (oc && oc.itens && oc.itens.length > 0) {
        const itemPendente = prodParam
          ? oc.itens.find((it) => it.idProd === Number(prodParam)) || oc.itens[0]
          : oc.itens.find((it) => it.quantidadeRecebida < it.quantidadePedida) || oc.itens[0];

        setIdProd(String(itemPendente.idProd));
        if (oc.dataEmissao) {
          setDataCompra(oc.dataEmissao.slice(0, 10));
        }
        const restante = Math.max(0, itemPendente.quantidadePedida - itemPendente.quantidadeRecebida);
        setQuantidadeRecebida(String(restante));
        if (locais.length > 0) {
          setAlocacoes([{ idLocal: locais[0].idLocal, quantidade: String(restante) }]);
        }
      }
    }
  }, [searchParams, ocs, locais]);

  const handleMudarOc = (novoIdOc) => {
    setIdOc(novoIdOc);
    if (!novoIdOc) {
      // Se limpou a OC (Entrada Avulsa), libera para preenchimento manual
      setQuantidadeRecebida("");
      setAlocacoes([{ idLocal: locais[0]?.idLocal || "", quantidade: "" }]);
      return;
    }
    const oc = ocs.find((o) => o.idOc === Number(novoIdOc));
    if (oc && oc.itens.length > 0) {
      const itemPendente = oc.itens.find((it) => it.quantidadeRecebida < it.quantidadePedida) || oc.itens[0];
      setIdProd(String(itemPendente.idProd));
      if (oc.dataEmissao) {
        setDataCompra(oc.dataEmissao.slice(0, 10));
      }
      const restante = Math.max(0, itemPendente.quantidadePedida - itemPendente.quantidadeRecebida);
      setQuantidadeRecebida(String(restante));
      if (locais.length > 0) {
        setAlocacoes([{ idLocal: locais[0].idLocal, quantidade: String(restante) }]);
      }
    }
  };

  const handleMudarProduto = (novoIdProd) => {
    setIdProd(novoIdProd);
    if (!novoIdProd) return;
    if (idOc) {
      const oc = ocs.find((o) => o.idOc === Number(idOc));
      const item = oc?.itens?.find((it) => it.idProd === Number(novoIdProd));
      if (item) {
        const restante = Math.max(0, item.quantidadePedida - item.quantidadeRecebida);
        setQuantidadeRecebida(String(restante));
        if (locais.length > 0 && alocacoes.length <= 1) {
          setAlocacoes([{ idLocal: locais[0].idLocal, quantidade: String(restante) }]);
        }
      }
    }
  };

  const handleMudarQtdRecebida = (val) => {
    setQuantidadeRecebida(val);
    if (alocacoes.length === 1) {
      setAlocacoes([{ ...alocacoes[0], quantidade: val }]);
    }
  };

  const adicionarGaveteiro = () => {
    if (locais.length === 0) return;
    setAlocacoes([...alocacoes, { idLocal: locais[0].idLocal, quantidade: "" }]);
  };

  const removerGaveteiro = (index) => {
    if (alocacoes.length === 1) return;
    setAlocacoes(alocacoes.filter((_, i) => i !== index));
  };

  const atualizarAlocacao = (index, campo, valor) => {
    const novas = [...alocacoes];
    novas[index][campo] = valor;
    setAlocacoes(novas);
  };

  const somaAlocada = alocacoes.reduce((acc, a) => acc + Number(a.quantidade || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idProd || !numLote || !quantidadeRecebida) {
      alertaErro("Produto, Número do Lote e Quantidade Recebida são obrigatórios.");
      return;
    }

    if (Number(quantidadeRecebida) !== somaAlocada) {
      alertaErro(
        `A soma das quantidades alocadas nos gaveteiros (${somaAlocada}) deve ser exatamente igual à quantidade recebida (${quantidadeRecebida}).`
      );
      return;
    }

    try {
      const payload = {
        idOc: idOc ? Number(idOc) : undefined,
        idProd: Number(idProd),
        numeroNf: numeroNf || null,
        numLote,
        dataCompra,
        dataFabricacao: dataFabricacao || null,
        dataValidade: dataValidade || null,
        quantidadeRecebida: Number(quantidadeRecebida),
        alocacoes: alocacoes.map((a) => ({
          idLocal: Number(a.idLocal),
          quantidade: Number(a.quantidade)
        }))
      };

      const resultado = await api.post("/lotes/recebimento", payload);
      alertaSucesso(
        `Lote '${resultado.numLote}' recebido com sucesso e estocado nos gaveteiros designados!`
      );
      navigate("/lotes");
    } catch (err) {
      alertaErro(err.message || "Erro ao registrar recebimento do lote.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <div>
        <h1>Recebimento de Lote & Vinculação Física</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Conferência física da carga, validação de prazos de validade e mapeamento direto nos gaveteiros da loja.
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <PackageCheck size={22} color="#1D4ED8" />
          <h2>Formulário de Entrada Física no Estoque</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Vínculo com Ordem de Compra ou Entrada Avulsa */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
            <label>
              <span>Vincular a uma Ordem de Compra</span>
              <select value={idOc} onChange={(e) => handleMudarOc(e.target.value)}>
                <option value="">Entrada Avulsa (Sem Ordem de Compra)</option>
                {ocs.map((o) => (
                  <option key={o.idOc} value={String(o.idOc)}>
                    OC #{o.idOc} — {o.fornecedor.nomeFantasia || o.fornecedor.razSocial} ({formatarData(o.dataEmissao)})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Número da Nota Fiscal de Entrada (NF-e)</span>
              <input
                type="text"
                className="mono"
                placeholder="Ex: NF-e 048291"
                value={numeroNf}
                onChange={(e) => setNumeroNf(e.target.value)}
              />
            </label>
          </div>

          {/* Dados do Produto e Lote (Com bloqueio automático condicional se houver OC) */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "14px" }}>
            <label>
              <span>
                Produto / Aviamento Recebido <span className="req-asterisk">*</span>
                {temOcVinculada && <span style={{ fontSize: "11px", color: "#1D4ED8", marginLeft: "6px" }}>(Bloqueado pela OC)</span>}
              </span>
              <select 
                required 
                value={idProd} 
                disabled={temOcVinculada}
                className={temOcVinculada ? "readonly-field" : ""}
                onChange={(e) => handleMudarProduto(e.target.value)}
              >
                <option value="">Selecione o produto...</option>
                {produtos.map((p) => (
                  <option key={p.idProd} value={String(p.idProd)}>
                    SKU {p.sku} — {p.nome} (Atual: {p.estoqueAtual} {p.unidMedida})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>
                Número do Lote do Fabricante <span className="req-asterisk">*</span>
              </span>
              <input
                type="text"
                required
                className="mono"
                placeholder="Ex: LT-2026-09A"
                value={numLote}
                onChange={(e) => setNumLote(e.target.value)}
              />
            </label>
          </div>

          {/* Datas (Data de Compra bloqueada condicionalmente se houver OC) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
            <label>
              <span>
                Data da Compra <span className="req-asterisk">*</span>
                {temOcVinculada && <span style={{ fontSize: "11px", color: "#1D4ED8", marginLeft: "6px" }}>(Definida na OC)</span>}
              </span>
              <input
                type="date"
                required
                disabled={temOcVinculada}
                className={temOcVinculada ? "readonly-field" : ""}
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </label>

            <label>
              <span>Data de Fabricação</span>
              <input
                type="date"
                value={dataFabricacao}
                onChange={(e) => setDataFabricacao(e.target.value)}
              />
            </label>

            <label>
              <span>
                Data de Validade <TooltipInfo text="Obrigatório para artigos perecíveis (colas, tintas). Deve ser maior ou igual à data de compra." />
              </span>
              <input
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
              />
            </label>
          </div>

          {/* Quantidade Recebida (Campo Custo Unitário removido conforme solicitado) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px" }}>
            <label>
              <span>
                Quantidade Recebida Física <span className="req-asterisk">*</span>
              </span>
              <input
                type="number"
                min="1"
                required
                className="mono"
                placeholder="Ex: 50"
                value={quantidadeRecebida}
                onChange={(e) => handleMudarQtdRecebida(e.target.value)}
              />
            </label>
          </div>

          {/* Seção Alocação em Gaveteiros Físicos */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div>
                <strong style={{ fontSize: "14px" }}>Alocação nos Gaveteiros / Locais Físicos:</strong>
                <span style={{ fontSize: "12px", color: "#64748B", display: "block" }}>
                  Distribua as {quantidadeRecebida || 0} unidades nos gaveteiros respeitando a capacidade disponível.
                </span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarGaveteiro}>
                <Plus size={14} />
                <span>Distribuir em outro gaveteiro</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {alocacoes.map((aloc, idx) => {
                const locInfo = locais.find((l) => l.idLocal === Number(aloc.idLocal));
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px auto", gap: "10px", alignItems: "center" }}>
                    <select
                      value={aloc.idLocal}
                      onChange={(e) => atualizarAlocacao(idx, "idLocal", e.target.value)}
                      style={{
                        height: "38px",
                        width: "100%",
                        minWidth: 0,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {locais.map((l) => (
                        <option key={l.idLocal} value={l.idLocal}>
                          {l.codigo} — {l.descricao} (Cap. Livre: {l.capacidadeLivre} un)
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Qtd no gaveteiro"
                      className="mono"
                      value={aloc.quantidade}
                      onChange={(e) => atualizarAlocacao(idx, "quantidade", e.target.value)}
                      style={{ height: "38px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                    />

                    {alocacoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerGaveteiro(idx)}
                        style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", padding: "6px" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "10px", color: somaAlocada === Number(quantidadeRecebida) ? "#166534" : "#DC2626" }}>
              <span>Total Alocado: <strong>{somaAlocada} un</strong></span>
              <span>Total Recebido: <strong>{quantidadeRecebida || 0} un</strong></span>
            </div>
          </div>

          <div style={{ textAlign: "right", marginTop: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
            <button type="submit" className="btn btn-primary" style={{ padding: "0 28px" }}>
              <span>Confirmar Recebimento e Estocar Lote</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}