const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "loja-guarani-api");
const envExample = path.join(apiDir, ".env.example");
const envTarget = path.join(apiDir, ".env");

console.log("[SETUP] Iniciando preparação do ambiente da Loja Guarani...");

// 1. Garantir .env
if (!fs.existsSync(envTarget)) {
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envTarget);
    console.log("[SETUP] Arquivo .env criado a partir de .env.example");
  } else {
    fs.writeFileSync(
      envTarget,
      `PORT=3000\nDATABASE_URL="file:./guarani.db"\nJWT_SECRET="chave_secreta_loja_guarani_bom_retiro_2026"\nJWT_EXPIRES_IN="8h"\nSAT_AMBIENTE="HOMOLOGACAO"\nSAT_CNPJ_EMITENTE="60716586000117"\nSAT_RAZAO_SOCIAL="HACIB CAMASMIE E CIA LTDA"\nSAT_NOME_FANTASIA="LOJA GUARANI - LOJA DO TURQUINHO"\nSAT_IE_EMITENTE="110042490114"\nENFORCE_BUSINESS_HOURS="false"\n`
    );
    console.log("[SETUP] Arquivo .env gerado com valores padrão.");
  }
} else {
  console.log("[SETUP] Arquivo .env já existe.");
}

// 2. Prisma generate
console.log("[SETUP] Gerando Prisma Client...");
execSync("npx prisma generate", { cwd: apiDir, stdio: "inherit" });

// 3. Prisma db push
console.log("[SETUP] Aplicando esquema ao banco de dados SQLite...");
execSync("npx prisma db push --skip-generate", { cwd: apiDir, stdio: "inherit" });

// 4. Executar seed (que também configura triggers e pragma do SQLite)
console.log("[SETUP] Executando carga inicial de dados (seed.js)...");
execSync("node prisma/seed.js", { cwd: apiDir, stdio: "inherit" });

console.log("[SETUP] Setup concluído com sucesso!");
