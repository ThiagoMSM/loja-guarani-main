const vendaService = require("../services/venda.service");

class VendaController {
  async previewFifo(req, res, next) {
    try {
      const itens = req.body.itens || (req.body.produtoId ? [req.body] : []);
      const preview = await vendaService.previewFifo(itens);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  async registrar(req, res, next) {
    try {
      const resultado = await vendaService.registrarVenda(req.body, req.user || {});
      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  async listar(req, res, next) {
    try {
      const vendas = await vendaService.listarVendas(req.query);
      res.json(vendas);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VendaController();
