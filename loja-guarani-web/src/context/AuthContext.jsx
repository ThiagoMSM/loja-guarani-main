import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("guarani_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem("guarani_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener("auth:logout", handleLogout);

    if (token) {
      api
        .get("/auth/me")
        .then((res) => {
          if (res.usuario) {
            setUser(res.usuario);
            localStorage.setItem("guarani_user", JSON.stringify(res.usuario));
          }
        })
        .catch(() => {
          // Token expirado ou inválido
          localStorage.removeItem("guarani_token");
          localStorage.removeItem("guarani_user");
          setUser(null);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [token]);

  const login = async (emailLogin, senha) => {
    const data = await api.post("/auth/login", { emailLogin, senha });
    localStorage.setItem("guarani_token", data.token);
    localStorage.setItem("guarani_user", JSON.stringify(data.usuario));
    setToken(data.token);
    setUser(data.usuario);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("guarani_token");
    localStorage.removeItem("guarani_user");
    setUser(null);
    setToken(null);
  };

  const isProprietario = user?.perfil === "PROPRIETARIO";
  const isVendedor = user?.perfil === "VENDEDOR";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isProprietario,
        isVendedor,
        isAuthenticated: !!token && !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
