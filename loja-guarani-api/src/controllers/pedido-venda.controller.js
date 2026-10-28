const pedidoVendaService = require("../services/pedido-venda.service");

class PedidoVendaController {
  async listar(req, res, next) {
    try {
      const pedidos = await pedidoVendaService.listar(req.query);
      res.json(pedidos);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const pedido = await pedidoVendaService.buscarPorId(req.params.id);
      res.json(pedido);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const novo = await pedidoVendaService.criar(req.body, req.user);
      res.status(201).json(novo);
    } catch (err) {
      next(err);
    }
  }

  async cancelar(req, res, next) {
    try {
      const cancelado = await pedidoVendaService.cancelar(req.params.id);
      res.json({ mensagem: "Pedido cancelado e reserva liberada.", pedido: cancelado });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PedidoVendaController();
