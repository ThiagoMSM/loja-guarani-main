function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Ocorreu um erro interno no servidor.";

  // Tratar erros nativos do Prisma / SQLite
  if (err.code === "P2002") {
    statusCode = 400;
    message = `Registro duplicado: o valor informado para o campo único já existe no sistema.`;
  } else if (err.code === "P2003") {
    statusCode = 400;
    message = `Restrição de integridade referencial: este registro possui vínculos que impedem a operação.`;
  } else if (err.message && err.message.includes("check_violation")) {
    statusCode = 400;
    message = `Violação de regra de banco de dados (CHECK constraint): ${err.message}`;
  } else if (err.message && err.message.includes("RN20:")) {
    statusCode = 400;
    message = err.message;
  }

  if (statusCode === 500) {
    console.error("[ERRO 500]", err);
  }

  res.status(statusCode).json({
    erro: message,
    statusCode
  });
}

module.exports = errorMiddleware;
