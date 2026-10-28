import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Eye, EyeOff, Lock, Mail, Store } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const { alertaErro, alertaSucesso } = useToast();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setCarregando(true);

    try {
      await login(email, senha);
      alertaSucesso("Autenticação realizada com sucesso!");
    } catch (err) {
      setMensagemErro(err.message || "Credenciais inválidas. Verifique os dados digitados.");
      alertaErro(err.message || "Falha na autenticação.");
    } finally {
      setCarregando(false);
    }
  };

  const preencherDemo = (loginDemo, senhaDemo) => {
    setEmail(loginDemo);
    setSenha(senhaDemo);
    setMensagemErro("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.1)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              backgroundColor: "#1E293B",
              borderRadius: "12px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
              color: "#60A5FA"
            }}
          >
            <Store size={28} />
          </div>
          <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>Loja Guarani</h1>
          <p style={{ fontSize: "13px", color: "#64748B" }}>
            Loja do Turquinho — Desde 1925 (Bom Retiro)
          </p>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#1D4ED8" }}>
            Sistema de Gestão de Estoque e Vendas
          </span>
        </div>

        {mensagemErro && (
          <div
            style={{
              backgroundColor: "#FEE2E2",
              border: "1px solid #DC2626",
              color: "#991B1B",
              borderRadius: "6px",
              padding: "10px 14px",
              fontSize: "13px",
              marginBottom: "18px"
            }}
          >
            {mensagemErro}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <label>
            <span>
              E-mail ou Login de Usuário <span className="req-asterisk">*</span>
            </span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Mail size={16} color="#94A3B8" style={{ position: "absolute", left: "12px" }} />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@lojaguarani.com.br"
                style={{ width: "100%", paddingLeft: "36px" }}
              />
            </div>
          </label>

          <label>
            <span>
              Senha de Acesso <span className="req-asterisk">*</span>
            </span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock size={16} color="#94A3B8" style={{ position: "absolute", left: "12px" }} />
              <input
                type={mostrarSenha ? "text" : "password"}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", paddingLeft: "36px", paddingRight: "36px" }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94A3B8",
                  padding: "4px"
                }}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={carregando}
            style={{ width: "100%", height: "42px", marginTop: "8px" }}
          >
            {carregando ? "Autenticando..." : "Entrar no Sistema"}
          </button>
        </form>

        {/* Demonstração Rápida */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", marginBottom: "8px", textTransform: "uppercase" }}>
            Acesso Rápido para Demonstração:
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: "11px" }}
              onClick={() => preencherDemo("roberto@lojaguarani.com.br", "Guarani@1925")}
            >
              Proprietário (Roberto)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: "11px" }}
              onClick={() => preencherDemo("vendedor1@lojaguarani.com.br", "Balcao@2026")}
            >
              Vendedor (Lucas)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
