const clienteService = require("../services/cliente.service");

class ClienteController {
  async listar(req, res, next) {
    try {
      const perfil = req.user ? req.user.perfil : "VENDEDOR";
      const clientes = await clienteService.listar(req.query, perfil);
      res.json(clientes);
    } catch (err) {
      next(err);
    }
  }

  async buscarPorId(req, res, next) {
    try {
      const perfil = req.user ? req.user.perfil : "VENDEDOR";
      const cliente = await clienteService.buscarPorId(req.params.id, perfil);
      res.json(cliente);
    } catch (err) {
      next(err);
    }
  }

  async criar(req, res, next) {
    try {
      const novo = await clienteService.criar(req.body);
      res.status(201).json(novo);
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const atualizado = await clienteService.atualizar(req.params.id, req.body);
      res.json(atualizado);
    } catch (err) {
      next(err);
    }
  }

  async anonimizar(req, res, next) {
    try {
      const cliente = await clienteService.anonimizar(req.params.id);
      res.json({ mensagem: "Dados cadastrais do titular anonimizados conforme LGPD.", cliente });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClienteController();
