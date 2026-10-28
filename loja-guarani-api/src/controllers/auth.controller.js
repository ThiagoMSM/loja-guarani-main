const authService = require("../services/auth.service");

class AuthController {
  async login(req, res, next) {
    try {
      const resultado = await authService.login(req.body);
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      res.json({ usuario: req.user });
    } catch (err) {
      next(err);
    }
  }

  async listarUsuarios(req, res, next) {
    try {
      const usuarios = await authService.listarUsuarios();
      res.json(usuarios);
    } catch (err) {
      next(err);
    }
  }

  async criarUsuario(req, res, next) {
    try {
      const usuario = await authService.criarUsuario(req.body);
      res.status(201).json(usuario);
    } catch (err) {
      next(err);
    }
  }

  async resetSenha(req, res, next) {
    try {
      const { novaSenha } = req.body;
      const resultado = await authService.resetSenha({
        idUsuario: req.params.id,
        novaSenha
      });
      res.json({ mensagem: "Senha redefinida com sucesso!", usuario: resultado });
    } catch (err) {
      next(err);
    }
  }

  async alterarStatus(req, res, next) {
    try {
      const { status } = req.body;
      const resultado = await authService.alterarStatusUsuario({
        idUsuario: req.params.id,
        status
      });
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
