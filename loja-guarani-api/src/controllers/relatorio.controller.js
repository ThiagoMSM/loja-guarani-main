const relatorioService = require("../services/relatorio.service");

class RelatorioController {
  async resumoDashboard(req, res, next) {
    try {
      const resumo = await relatorioService.obterResumoDashboard();
      res.json(resumo);
    } catch (err) {
      next(err);
    }
  }

  async posicaoEstoque(req, res, next) {
    try {
      const itens = await relatorioService.posicaoEstoque(req.query);
      res.json(itens);
    } catch (err) {
      next(err);
    }
  }

  async controleValidade(req, res, next) {
    try {
      const dados = await relatorioService.controleValidade(req.query);
      res.json(dados);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RelatorioController();
