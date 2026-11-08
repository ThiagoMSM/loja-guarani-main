function limparDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function validarCNPJ(cnpj) {
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

function formatarCNPJ(cnpj) {
  const s = limparDigitos(cnpj);
  if (s.length !== 14) return cnpj;
  return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function validarCPF(cpf) {
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

function mascararDocumentoLgpd(doc) {
  if (!doc) return null;
  const s = limparDigitos(doc);
  if (s.length === 11) return `***.${s.slice(3, 6)}.${s.slice(6, 9)}-**`;
  if (s.length === 14) return `${s.slice(0, 2)}.***.***/${s.slice(8, 12)}-**`;
  return "***.***.***-**";
}

function gerarCPFValido() {
  let n;
  do {
    n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (/^(\d)\1+$/.test(n.join("")));
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += n[i] * (10 - i);
  let r = (soma * 10) % 11;
  const d1 = r === 10 || r === 11 ? 0 : r;
  n.push(d1);
  soma = 0;
  for (let i = 0; i < 10; i++) soma += n[i] * (11 - i);
  r = (soma * 10) % 11;
  const d2 = r === 10 || r === 11 ? 0 : r;
  n.push(d2);
  const s = n.join("");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
}

module.exports = {
  limparDigitos,
  validarCNPJ,
  formatarCNPJ,
  validarCPF,
  gerarCPFValido,
  mascararDocumentoLgpd
};
