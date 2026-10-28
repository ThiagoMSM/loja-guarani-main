import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { Layout } from "./components/Layout";

// 14 Telas Oficiais do Sistema (Loja Guarani)
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CategoriasPage } from "./pages/CategoriasPage";
import { ProdutosPage } from "./pages/ProdutosPage";
import { LocaisPage } from "./pages/LocaisPage";
import { FornecedoresPage } from "./pages/FornecedoresPage";
import { OrdensCompraPage } from "./pages/OrdensCompraPage";
import { RecebimentoLotePage } from "./pages/RecebimentoLotePage";
import { LotesAccordionPage } from "./pages/LotesAccordionPage";
import { PedidoBalcaoPage } from "./pages/PedidoBalcaoPage";
import { CaixaVendaPage } from "./pages/CaixaVendaPage";
import { ConsultaEstoquePage } from "./pages/ConsultaEstoquePage";
import { RelatorioValidadePage } from "./pages/RelatorioValidadePage";
import { AjusteEstoquePage } from "./pages/AjusteEstoquePage";

function ProtectedRoute({ children, roleRequired }) {
  const { loading, isAuthenticated, isProprietario } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#F8FAFC",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid #CBD5E1",
            borderTopColor: "var(--color-navy)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }}
        />
        <div style={{ color: "#64748B", fontWeight: "600", fontSize: "0.875rem" }}>
          Carregando Loja Guarani...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roleRequired === "PROPRIETARIO" && !isProprietario) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#F8FAFC"
        }}
      >
        <div style={{ color: "#64748B", fontWeight: "600" }}>Carregando...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Rota Pública: Login */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            {/* Rotas Operacionais e Gerenciais Protegidas */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/balcao"
              element={
                <ProtectedRoute>
                  <PedidoBalcaoPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/caixa"
              element={
                <ProtectedRoute>
                  <CaixaVendaPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/consulta-estoque"
              element={
                <ProtectedRoute>
                  <ConsultaEstoquePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lotes"
              element={
                <ProtectedRoute>
                  <LotesAccordionPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/produtos"
              element={
                <ProtectedRoute>
                  <ProdutosPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/categorias"
              element={
                <ProtectedRoute>
                  <CategoriasPage />
                </ProtectedRoute>
              }
            />

            {/* Rotas Administrativas Exclusivas da Proprietária */}
            <Route
              path="/recebimento"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <RecebimentoLotePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ordens-compra"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <OrdensCompraPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/locais"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <LocaisPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/fornecedores"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <FornecedoresPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/relatorio-validade"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <RelatorioValidadePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ajuste-estoque"
              element={
                <ProtectedRoute roleRequired="PROPRIETARIO">
                  <AjusteEstoquePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback de rotas desconhecidas */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
