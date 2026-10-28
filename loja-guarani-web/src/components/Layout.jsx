import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { HelpDrawer } from "./HelpDrawer";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Search,
  Boxes,
  FolderTree,
  Package,
  MapPin,
  Truck,
  FileSpreadsheet,
  PackageCheck,
  CalendarClock,
  SlidersHorizontal,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  X
} from "lucide-react";

export function Layout({ children }) {
  const { user, logout, isProprietario } = useAuth();
  const { alertasContagem } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  // Atalhos Globais de Teclado (F1 = Ajuda, F2 = Balcão, F3 = Consulta)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      } else if (e.key === "F2") {
        e.preventDefault();
        navigate("/balcao");
      } else if (e.key === "F3") {
        e.preventDefault();
        navigate("/consulta-estoque");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const navItems = [
    { path: "/", label: "Painel Inicial", icon: LayoutDashboard, role: "TODOS" },
    { path: "/balcao", label: "Pedido Balcão (F2)", icon: ClipboardList, role: "TODOS" },
    { path: "/caixa", label: "Caixa & Venda SAT", icon: ShoppingCart, role: "TODOS" },
    { path: "/consulta-estoque", label: "Consultar Estoque (F3)", icon: Search, role: "TODOS" },
    { path: "/lotes", label: "Lotes em Sanfona", icon: Boxes, role: "TODOS" },
    { path: "/produtos", label: "Produtos", icon: Package, role: "TODOS" },
    { path: "/categorias", label: "Categorias", icon: FolderTree, role: "TODOS" },
    // Módulos restritos ao Proprietário
    { path: "/recebimento", label: "Receber Lote", icon: PackageCheck, role: "PROPRIETARIO" },
    { path: "/ordens-compra", label: "Ordens de Compra", icon: FileSpreadsheet, role: "PROPRIETARIO" },
    { path: "/locais", label: "Locais / Gaveteiros", icon: MapPin, role: "PROPRIETARIO" },
    { path: "/fornecedores", label: "Fornecedores", icon: Truck, role: "PROPRIETARIO" },
    { path: "/relatorio-validade", label: "Controle de Validade", icon: CalendarClock, role: "PROPRIETARIO" },
    { path: "/ajuste-estoque", label: "Ajuste de Estoque", icon: SlidersHorizontal, role: "PROPRIETARIO" }
  ];

  const itensFiltrados = navItems.filter(
    (item) => item.role === "TODOS" || (item.role === "PROPRIETARIO" && isProprietario)
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
      {/* Sidebar Desktop e Mobile */}
      <aside
        style={{
          width: "240px",
          backgroundColor: "#1E293B",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 100,
          transition: "transform 0.2s ease"
        }}
        className={sidebarMobileOpen ? "sidebar-open" : ""}
      >
        {/* Topo da Sidebar: Identidade Loja Guarani */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #334155" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: "700", letterSpacing: "0.5px" }}>
                Loja Guarani
              </h2>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Desde 1925 • Bom Retiro</span>
            </div>
            {sidebarMobileOpen && (
              <button
                onClick={() => setSidebarMobileOpen(false)}
                style={{ background: "transparent", border: "none", color: "#FFFFFF", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Links de Navegação */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
          {itensFiltrados.map((item) => {
            const Icon = item.icon;
            const ativo = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarMobileOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  color: ativo ? "#FFFFFF" : "#CBD5E1",
                  backgroundColor: ativo ? "#1D4ED8" : "transparent",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: ativo ? "600" : "500",
                  transition: "background-color 0.15s"
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user?.nome || "Usuário"}
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8" }}>
              {user?.perfil === "PROPRIETARIO" ? "Proprietário" : "Vendedor Balcão"}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sair do sistema"
            style={{
              background: "transparent",
              border: "none",
              color: "#EF4444",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header Superior Fixo (64px) */}
        <header
          style={{
            height: "64px",
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 90
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setSidebarMobileOpen(true)}
              style={{
                display: "none",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px"
              }}
              className="mobile-menu-btn"
            >
              <Menu size={22} color="#334155" />
            </button>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}>
              Sistema de Gestão de Estoque e Vendas
            </span>
          </div>

          {/* Atalhos e Indicadores à Direita */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Atalhos Rápidos */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/balcao")}
              title="Atalho F2: Balcão de Vendas"
            >
              <ClipboardList size={15} />
              <span>Balcão (F2)</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/consulta-estoque")}
              title="Atalho F3: Consulta Rápida de Estoque"
            >
              <Search size={15} />
              <span>Estoque (F3)</span>
            </button>

            {/* Sino de Notificações de Estoque Mínimo */}
            <button
              onClick={() => navigate("/")}
              title={`${alertasContagem} produto(s) abaixo do estoque mínimo`}
              style={{
                position: "relative",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                display: "flex",
                alignItems: "center",
                color: alertasContagem > 0 ? "#DC2626" : "#64748B"
              }}
            >
              <Bell size={20} />
              {alertasContagem > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    backgroundColor: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: "bold",
                    borderRadius: "10px",
                    minWidth: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px"
                  }}
                >
                  {alertasContagem}
                </span>
              )}
            </button>

            {/* Perfil Tag */}
            <span
              className={`badge ${isProprietario ? "badge-info" : "badge-neutral"}`}
              style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}
            >
              {user?.perfil}
            </span>

            {/* Botão de Ajuda F1 */}
            <button
              onClick={() => setHelpOpen(true)}
              title="Ajuda Contextual (F1)"
              style={{
                background: "transparent",
                border: "none",
                color: "#1D4ED8",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center"
              }}
            >
              <HelpCircle size={22} />
            </button>
          </div>
        </header>

        {/* Área de Conteúdo */}
        <main style={{ flex: 1, padding: "24px", maxWidth: "1440px", width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>

      {/* Drawer Deslizante de Ajuda Contextual (F1) */}
      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
