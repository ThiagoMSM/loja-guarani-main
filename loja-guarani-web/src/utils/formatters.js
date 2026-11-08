export function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(dataStr) {
  if (!dataStr) return "-";
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function formatarDataHora(dataStr) {
  if (!dataStr) return "-";
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export function limparDigitos(str) {
  return String(str || "").replace(/\D/g, "");
}

export function formatarCNPJ(cnpj) {
  const s = limparDigitos(cnpj);
  if (s.length !== 14) return cnpj || "";
  return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function mascaraCNPJ(valor) {
  const s = limparDigitos(valor).slice(0, 14);
  if (s.length <= 2) return s;
  if (s.length <= 5) return s.replace(/^(\d{2})(\d+)/, "$1.$2");
  if (s.length <= 8) return s.replace(/^(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (s.length <= 12) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
}

export function formatarCPF(cpf) {
  const s = limparDigitos(cpf);
  if (s.length !== 11) return cpf || "";
  return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function validarCNPJ(cnpj) {
  const s = limparDigitos(cnpj);
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calc(s, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(s, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(s[12]) === d1 && Number(s[13]) === d2;
}

export function validarCPF(cpf) {
  const s = limparDigitos(cpf);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(s[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== Number(s[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(s[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === Number(s[10]);
}

export function mascaraCPF(valor) {
  const s = limparDigitos(valor).slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 6) return s.replace(/^(\d{3})(\d+)/, "$1.$2");
  if (s.length <= 9) return s.replace(/^(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
}

export function mascaraDocumento(valor) {
  const s = limparDigitos(valor);
  if (s.length > 11) return mascaraCNPJ(s);
  return mascaraCPF(s);
}
