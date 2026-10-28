const produtoService = require("../services/produto.service");

class ProdutoController {
  async listar(req, res, next) {
    try {
      const produtos = await produtoService.listar(req.query);
      res.json(produtos);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const produto = await produtoService.buscarPorId(req.params.id);
      res.json(produto);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const idUsuario = req.user ? req.user.idUsuario : 1;
      const produto = await produtoService.criar(req.body, idUsuario);
      res.status(201).json(produto);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const produto = await produtoService.atualizar(req.params.id, req.body);
      res.json(produto);
    } catch (err) {
      next(err);
    }
  }

  async alterarStatus(req, res, next) {
    try {
      const { status } = req.body;
      const produto = await produtoService.alterarStatus(req.params.id, status);
      res.json(produto);
    } catch (err) {
      next(err);
    }
  }

  async excluir(req, res, next) {
    try {
      await produtoService.excluir(req.params.id);
      res.json({ mensagem: "Produto excluído com sucesso." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProdutoController();
