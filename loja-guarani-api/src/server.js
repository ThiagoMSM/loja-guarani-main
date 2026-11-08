require("dotenv").config();
const app = require("./app");
const prisma = require("./lib/prisma");
const { aplicarConstraintsBanco } = require("./lib/db-constraints");

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Configura PRAGMAs e triggers nativos de integridade do SQLite
    await aplicarConstraintsBanco(prisma);
    console.log("[DATABASE] Integridade do SGBD SQLite e PRAGMAs configurados.");

    // Atualização automática de status de lotes vencidos
    const loteService = new (require("./services/lote.service"))();
    await loteService.atualizarStatusLotesVencidos();
    console.log("[ESTOQUE] Rotina de verificação de lotes vencidos concluída.");

    app.listen(PORT, () => {
      console.log(`[Loja Guarani API] Servidor MVC + Service Layer rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[FATAL] Erro ao inicializar o servidor:", err);
    process.exit(1);
  }
}

bootstrap();
