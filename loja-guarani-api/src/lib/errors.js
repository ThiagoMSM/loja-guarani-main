class ErroDeNegocio extends Error {
  constructor(message) {
    super(message);
    this.name = "ErroDeNegocio";
    this.statusCode = 400;
  }
}

class ErroNaoAutorizado extends Error {
  constructor(message = "Não autorizado.") {
    super(message);
    this.name = "ErroNaoAutorizado";
    this.statusCode = 401;
  }
}

class ErroProibido extends Error {
  constructor(message = "Acesso negado: operação exclusiva do perfil PROPRIETARIO.") {
    super(message);
    this.name = "ErroProibido";
    this.statusCode = 403;
  }
}

class ErroNaoEncontrado extends Error {
  constructor(message = "Recurso não encontrado.") {
    super(message);
    this.name = "ErroNaoEncontrado";
    this.statusCode = 404;
  }
}

module.exports = {
  ErroDeNegocio,
  ErroNaoAutorizado,
  ErroProibido,
  ErroNaoEncontrado
};
