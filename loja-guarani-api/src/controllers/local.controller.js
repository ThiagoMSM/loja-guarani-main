const localService = require("../services/local.service");

class LocalController {
  async listar(req, res, next) {
    try {
      const locais = await localService.listar(req.query);
      res.json(locais);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const local = await localService.buscarPorId(req.params.id);
      res.json(local);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const novo = await localService.criar(req.body);
      res.status(201).json(novo);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const local = await localService.atualizar(req.params.id, req.body);
      res.json(local);
    } catch (err) {
      next(err);
    }
  }

  async inativar(req, res, next) {
    try {
      const local = await localService.inativar(req.params.id);
      res.json({ mensagem: "Local inativado com sucesso.", local });
    } catch (err) {
      next(err);
    }
  }

  async excluir(req, res, next) {
    try {
      await localService.excluir(req.params.id);
      res.json({ mensagem: "Local excluído com sucesso." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LocalController();
