const loteService = require("../services/lote.service");

class LoteController {
  async listar(req, res, next) {
    try {
      const lotes = await loteService.listar(req.query);
      res.json(lotes);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const lote = await loteService.buscarPorId(req.params.id);
      res.json(lote);
    } catch (err) {
      next(err);
    }
  }

  async receberLote(req, res, next) {
    try {
      const idUsuario = req.user ? req.user.idUsuario : 1;
      const lote = await loteService.receberLote(req.body, idUsuario);
      res.status(201).json(lote);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const lote = await loteService.atualizar(req.params.id, req.body);
      res.json(lote);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LoteController();
