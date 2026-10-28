const { getConfig, updateConfig } = require("../config/runtime-config");

class ConfigController {
  async obter(req, res, next) {
    try {
      res.json(getConfig());
    } catch (err) {
      next(err);
    }
  }

  async atualizar(req, res, next) {
    try {
      const config = updateConfig(req.body);
      res.json({ mensagem: "Configurações em tempo real atualizadas.", config });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConfigController();
