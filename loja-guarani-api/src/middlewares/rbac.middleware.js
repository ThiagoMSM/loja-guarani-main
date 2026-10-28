const { ErroProibido } = require("../lib/errors");

function requireRole(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.user || !perfisPermitidos.includes(req.user.perfil)) {
      return next(
        new ErroProibido("Acesso negado: operação exclusiva do perfil PROPRIETARIO.")
      );
    }
    next();
  };
}

module.exports = { requireRole };
