const alertaService = require("../services/alerta.service");

class AlertaController {
  async listar(req, res, next) {
    try {
      const alertas = await alertaService.listarAlertas();
      res.json(alertas);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AlertaController();
