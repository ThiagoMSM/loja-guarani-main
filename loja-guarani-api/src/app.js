const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const routes = require("./routes");
const errorMiddleware = require("./middlewares/error.middleware");
const produtoController = require("./controllers/produto.controller");
const vendaController = require("./controllers/venda.controller");

const app = express();

app.use(cors());
app.use(express.json());

// Aliases para conformidade com o tutorial de referência (Capítulo 11.3 do PDF)
app.get("/produtos", (req, res, next) => produtoController.listar(req, res, next));
app.post("/vendas", (req, res, next) => vendaController.registrar(req, res, next));

// Rotas da API REST completa
app.use("/api", routes);

// Servir frontend compilado em produção / modo unificado (npm start)
const frontendDistPath = path.resolve(__dirname, "../../loja-guarani-web/dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/produtos" || req.path === "/vendas") {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Tratador global de erros
app.use(errorMiddleware);

module.exports = app;
