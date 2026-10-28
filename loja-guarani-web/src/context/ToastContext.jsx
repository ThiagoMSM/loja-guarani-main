import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { api } from "../api/client";

const ToastContext = createContext({});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [alertasContagem, setAlertasContagem] = useState(0);

  const addToast = useCallback((mensagem, tipo = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, mensagem, tipo }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const carregarContagemAlertas = useCallback(async () => {
    try {
      const token = localStorage.getItem("guarani_token");
      if (!token) return;
      const res = await api.get("/alertas");
      if (Array.isArray(res)) {
        setAlertasContagem(res.length);
      }
    } catch {
      // Ignorar falhas silenciosamente
    }
  }, []);

  useEffect(() => {
    carregarContagemAlertas();
    const interval = setInterval(carregarContagemAlertas, 30000); // 30s
    return () => clearInterval(interval);
  }, [carregarContagemAlertas]);

  return (
    <ToastContext.Provider
      value={{
        addToast,
        alertaSucesso: (msg) => addToast(msg, "success"),
        alertaErro: (msg) => addToast(msg, "danger"),
        alertaAviso: (msg) => addToast(msg, "warning"),
        alertaInfo: (msg) => addToast(msg, "info"),
        alertasContagem,
        recarregarAlertas: carregarContagemAlertas
      }}
    >
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          let Icon = CheckCircle2;
          let className = "toast ";
          if (t.tipo === "success") {
            Icon = CheckCircle2;
            className += "badge-success";
          } else if (t.tipo === "danger") {
            Icon = XCircle;
            className += "badge-danger";
          } else if (t.tipo === "warning") {
            Icon = AlertTriangle;
            className += "badge-warning";
          } else {
            Icon = Info;
            className += "badge-info";
          }

          return (
            <div key={t.id} className={className} style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon size={18} />
                <span>{t.mensagem}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  height: "auto",
                  color: "inherit"
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
