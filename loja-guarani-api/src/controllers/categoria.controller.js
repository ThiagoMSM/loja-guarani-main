const categoriaService = require("../services/categoria.service");

class CategoriaController {
  async listar(req, res, next) {
    try {
      const categorias = await categoriaService.listar();
      res.json(categorias);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const categoria = await categoriaService.buscarPorId(req.params.id);
      res.json(categoria);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const nova = await categoriaService.criar(req.body);
      res.status(201).json(nova);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const atualizada = await categoriaService.atualizar(req.params.id, req.body);
      res.json(atualizada);
    } catch (err) {
      next(err);
    }
  }

  async excluir(req, res, next) {
    try {
      await categoriaService.excluir(req.params.id);
      res.json({ mensagem: "Categoria excluída com sucesso." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CategoriaController();
