import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatarMoeda, formatarData } from "../utils/formatters";
import { Badge } from "../components/Badge";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Search,
  PlusCircle,
  Calendar,
  DollarSign,
  MapPin,
  Truck
} from "lucide-react";

export function LotesAccordionPage() {
  const { isProprietario } = useAuth();
  const { alertaErro } = useToast();
  const navigate = useNavigate();

  const [produtos, setProdutos] = useState([]);
  const [buscaLote, setBuscaLote] = useState("");
  const [buscaCategoria, setBuscaCategoria] = useState("");
  const [abertos, setAbertos] = useState({});
  const [carregando, setCarregando] = useState(false);

  const carregarProdutosComLotes = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/produtos");
      setProdutos(res);
      // Abrir o primeiro produto por padrão para exibição inicial agradável
      if (res.length > 0) {
        setAbertos({ [res[0].idProd]: true });
      }
    } catch (err) {
      alertaErro(err.message || "Erro ao carregar lotes de estoque.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarProdutosComLotes();
  }, []);

  const toggleAccordion = (idProd) => {
    setAbertos((prev) => ({
      ...prev,
      [idProd]: !prev[idProd]
    }));
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const produtosFiltrados = produtos.filter((p) => {
    const matchCat =
      !buscaCategoria ||
      (p.categoria?.nome && p.categoria.nome.toLowerCase().includes(buscaCategoria.toLowerCase()));

    const matchLote =
      !buscaLote ||
      p.lotes.some(
        (l) =>
          l.numLote.toLowerCase().includes(buscaLote.toLowerCase()) ||
          (l.numeroNf && l.numeroNf.toLowerCase().includes(buscaLote.toLowerCase()))
      ) ||
      p.nome.toLowerCase().includes(buscaLote.toLowerCase()) ||
      p.sku.toLowerCase().includes(buscaLote.toLowerCase());

    return matchCat && matchLote;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1>Gerenciamento de Lotes em Sanfona</h1>
        <p style={{ color: "#64748B", fontSize: "14px" }}>
          Padrão de revelação progressiva em acordeão para inspeção de levas de compra, ordenação PEPS/FIFO e validades.
        </p>
      </div>

      {/* Barra de Filtros Rápidos do Topo */}
      <div className="card" style={{ padding: "14px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "12px" }} />
            <input
              type="text"
              placeholder="Pesquisar lote, nota fiscal ou produto..."
              value={buscaLote}
              onChange={(e) => setBuscaLote(e.target.value)}
              style={{ width: "100%", paddingLeft: "34px" }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "12px" }} />
            <input
              type="text"
              placeholder="Pesquisar categoria de aviamentos..."
              value={buscaCategoria}
              onChange={(e) => setBuscaCategoria(e.target.value)}
              style={{ width: "100%", paddingLeft: "34px" }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Produtos com Acordeão */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {produtosFiltrados.length === 0 ? (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
            Nenhum produto ou lote localizado para os filtros informados.
          </div>
        ) : (
          produtosFiltrados.map((prod) => {
            const estaAberto = !!abertos[prod.idProd];

            return (
              <div
                key={prod.idProd}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  backgroundColor: "#FFFFFF",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
                }}
              >
                {/* Cabeçalho do Card (Clicável para expandir) */}
                <div
                  onClick={() => toggleAccordion(prod.idProd)}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    backgroundColor: estaAberto ? "#F8FAFC" : "#FFFFFF",
                    borderBottom: estaAberto ? "1px solid #E2E8F0" : "none",
                    transition: "background-color 0.15s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ color: estaAberto ? "#1D4ED8" : "#64748B" }}>
                      {estaAberto ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="mono" style={{ fontSize: "13px", fontWeight: "700", color: "#1D4ED8" }}>
                          SKU {prod.sku}
                        </span>
                        <strong style={{ fontSize: "15px" }}>{prod.nome}</strong>
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748B" }}>
                        Categoria: {prod.categoria?.nome || "-"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", color: "#64748B", display: "block" }}>Saldo Físico Total</span>
                      <strong className="mono" style={{ fontSize: "15px", color: "#0F172A" }}>
                        {prod.estoqueAtual} {prod.unidMedida}
                      </strong>
                    </div>

                    <Badge variant={prod.lotes?.length > 0 ? "neutral" : "warning"}>
                      {prod.lotes?.length || 0} lote(s)
                    </Badge>
                  </div>
                </div>

                {/* Conteúdo Sanfona (Lotes Ativos do Produto) */}
                {estaAberto && (
                  <div style={{ padding: "16px 20px", backgroundColor: "#FFFFFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                        Lotes Ativos (Ordenação de Saída PEPS/FIFO):
                      </span>
                      {isProprietario && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/recebimento?idProd=${prod.idProd}`);
                          }}
                        >
                          <PlusCircle size={14} color="#1D4ED8" />
                          <span>Adicionar Lote a este Produto</span>
                        </button>
                      )}
                    </div>

                    {(!prod.lotes || prod.lotes.length === 0) ? (
                      <div style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "6px", textAlign: "center", fontSize: "13px", color: "#64748B" }}>
                        Nenhum lote cadastrado para este produto.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                        {prod.lotes.map((lote) => {
                          const vencido = lote.dataValidade && new Date(lote.dataValidade) < hoje;
                          const esgotado = lote.quantidadeAtual === 0;

                          return (
                            <div
                              key={lote.idLote}
                              style={{
                                border: "1px solid #E2E8F0",
                                borderRadius: "6px",
                                padding: "12px",
                                backgroundColor: vencido ? "#FFF5F5" : esgotado ? "#F8FAFC" : "#FFFFFF"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                                <div>
                                  <span style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase" }}>
                                    Lote
                                  </span>
                                  <div className="mono" style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>
                                    {lote.numLote}
                                  </div>
                                </div>
                                <Badge variant={vencido ? "danger" : esgotado ? "neutral" : "success"}>
                                  {vencido ? "VENCIDO" : esgotado ? "ESGOTADO" : "DISPONÍVEL"}
                                </Badge>
                              </div>

                              <div style={{ fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "3px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Boxes size={13} color="#64748B" />
                                  <span>
                                    Saldo: <strong className="mono">{lote.quantidadeAtual}</strong> de {lote.quantidadeRecebida} {prod.unidMedida}
                                  </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Calendar size={13} color="#64748B" />
                                  <span>Compra: {formatarData(lote.dataCompra)}</span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Calendar size={13} color={vencido ? "#DC2626" : "#64748B"} />
                                  <span style={{ color: vencido ? "#DC2626" : "inherit" }}>
                                    Validade: <strong>{formatarData(lote.dataValidade)}</strong>
                                  </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <DollarSign size={13} color="#64748B" />
                                  <span>Custo: <span className="mono">{formatarMoeda(lote.valorCompra)}</span></span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <MapPin size={13} color="#1D4ED8" />
                                  <span>
                                    Gaveteiro:{" "}
                                    <strong className="mono">
                                      {lote.locais?.map((ll) => `${ll.local.codigo} (${ll.quantidade})`).join(", ") || "-"}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
