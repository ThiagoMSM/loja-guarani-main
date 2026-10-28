const ordemCompraService = require("../services/ordem-compra.service");

class OrdemCompraController {
  async listar(req, res, next) {
    try {
      const ocs = await ordemCompraService.listar(req.query);
      res.json(ocs);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const oc = await ordemCompraService.buscarPorId(req.params.id);
      res.json(oc);
    } catch (err) {
      next(err);
    }
  }

  async emitir(req, res, next) {
    try {
      const idUsuario = req.user ? req.user.idUsuario : 1;
      const oc = await ordemCompraService.emitir(req.body, idUsuario);
      res.status(201).json(oc);
    } catch (err) {
      next(err);
    }
  }

  async cancelar(req, res, next) {
    try {
      const cancelada = await ordemCompraService.cancelar(req.params.id);
      res.json({ mensagem: "Ordem de Compra cancelada com sucesso.", ordemCompra: cancelada });
    } catch (err) {
      next(err);
    }
  }

  async sugerirItens(req, res, next) {
    try {
      const itens = await ordemCompraService.sugerirItensPorFornecedor(req.params.idFornec);
      res.json(itens);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrdemCompraController();
