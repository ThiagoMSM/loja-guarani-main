const fornecedorService = require("../services/fornecedor.service");

class FornecedorController {
  async listar(req, res, next) {
    try {
      const fornecedores = await fornecedorService.listar(req.query);
      res.json(fornecedores);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const fornecedor = await fornecedorService.buscarPorId(req.params.id);
      res.json(fornecedor);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const novo = await fornecedorService.criar(req.body);
      res.status(201).json(novo);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const fornecedor = await fornecedorService.atualizar(req.params.id, req.body);
      res.json(fornecedor);
    } catch (err) {
      next(err);
    }
  }

  async vincularProduto(req, res, next) {
    try {
      const vinculo = await fornecedorService.vincularProduto(req.params.id, req.body);
      res.status(201).json(vinculo);
    } catch (err) {
      next(err);
    }
  }

  async removerVinculoProduto(req, res, next) {
    try {
      await fornecedorService.removerVinculoProduto(req.params.id, req.params.idProd);
      res.json({ mensagem: "Vínculo de produto removido com sucesso." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FornecedorController();
