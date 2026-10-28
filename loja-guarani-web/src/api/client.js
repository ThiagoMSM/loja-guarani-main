const API_BASE = "/api";

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const token = localStorage.getItem("guarani_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("guarani_token");
      localStorage.removeItem("guarani_user");
      window.dispatchEvent(new Event("auth:logout"));
    }
    const error = new Error(data.erro || data.message || `Erro HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: "GET" }),
  post: (endpoint, body) => apiRequest(endpoint, { method: "POST", body }),
  put: (endpoint, body) => apiRequest(endpoint, { method: "PUT", body }),
  patch: (endpoint, body) => apiRequest(endpoint, { method: "PATCH", body }),
  delete: (endpoint) => apiRequest(endpoint, { method: "DELETE" })
};
