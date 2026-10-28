const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { ErroNaoAutorizado, ErroProibido } = require("../lib/errors");
const { getConfig, isBusinessHoursNow } = require("../config/runtime-config");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ErroNaoAutorizado("Token de autenticação não fornecido.");
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "chave_secreta_loja_guarani_bom_retiro_2026";
    let decoded;

    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw new ErroNaoAutorizado("Sessão expirada ou token inválido.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: decoded.idUsuario },
      include: { vendedor: true }
    });

    if (!usuario) {
      throw new ErroNaoAutorizado("Usuário da sessão não localizado.");
    }

    if (usuario.status !== "ATIVO") {
      throw new ErroProibido("Conta de usuário inativa ou bloqueada.");
    }

    // Validação RNF10 se a trava de horário estiver ativada
    const config = getConfig();
    if (config.enforceBusinessHours && usuario.perfil === "VENDEDOR") {
      if (!isBusinessHoursNow()) {
        throw new ErroProibido(
          "Acesso restrito ao horário comercial da Loja Guarani (Segunda a Sexta, das 10h00 às 18h00)."
        );
      }
    }

    req.user = {
      idUsuario: usuario.idUsuario,
      nome: usuario.nome,
      emailLogin: usuario.emailLogin,
      perfil: usuario.perfil,
      idVend: usuario.vendedor ? usuario.vendedor.idVend : null
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
