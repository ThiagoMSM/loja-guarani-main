const ajusteService = require("../services/ajuste.service");

class AjusteController {
  async listar(req, res, next) {
    try {
      const historico = await ajusteService.listarHistorico(req.query);
      res.json(historico);
    } catch (err) {
      next(err);
    }
  }

  async registrar(req, res, next) {
    try {
      const idUsuario = req.user ? req.user.idUsuario : 1;
      const resultado = await ajusteService.registrarAjuste(req.body, idUsuario);
      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AjusteController();
