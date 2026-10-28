const { Router } = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/rbac.middleware");

const authController = require("../controllers/auth.controller");
const configController = require("../controllers/config.controller");
const categoriaController = require("../controllers/categoria.controller");
const produtoController = require("../controllers/produto.controller");
const localController = require("../controllers/local.controller");
const fornecedorController = require("../controllers/fornecedor.controller");
const ordemCompraController = require("../controllers/ordem-compra.controller");
const loteController = require("../controllers/lote.controller");
const clienteController = require("../controllers/cliente.controller");
const pedidoVendaController = require("../controllers/pedido-venda.controller");
const vendaController = require("../controllers/venda.controller");
const ajusteController = require("../controllers/ajuste.controller");
const alertaController = require("../controllers/alerta.controller");
const relatorioController = require("../controllers/relatorio.controller");

const router = Router();

// 1. Autenticação e Usuários (UC13)
router.post("/auth/login", (req, res, next) => authController.login(req, res, next));
router.get("/auth/me", authMiddleware, (req, res, next) => authController.me(req, res, next));
router.get("/usuarios", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  authController.listarUsuarios(req, res, next)
);
router.post("/usuarios", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  authController.criarUsuario(req, res, next)
);
router.patch("/usuarios/:id/reset-senha", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  authController.resetSenha(req, res, next)
);
router.patch("/usuarios/:id/status", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  authController.alterarStatus(req, res, next)
);

// 2. Configurações em Tempo Real (RNF10 e Teste SAT)
router.get("/config/runtime", authMiddleware, (req, res, next) => configController.obter(req, res, next));
router.patch("/config/runtime", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  configController.atualizar(req, res, next)
);

// 3. Dashboard e Alertas (UC14)
router.get("/dashboard/resumo", authMiddleware, (req, res, next) =>
  relatorioController.resumoDashboard(req, res, next)
);
router.get("/alertas", authMiddleware, (req, res, next) => alertaController.listar(req, res, next));

// 4. Categorias (UC03)
router.get("/categorias", authMiddleware, (req, res, next) => categoriaController.listar(req, res, next));
router.get("/categorias/:id", authMiddleware, (req, res, next) =>
  categoriaController.buscarPorId(req, res, next)
);
router.post("/categorias", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  categoriaController.criar(req, res, next)
);
router.put("/categorias/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  categoriaController.atualizar(req, res, next)
);
router.delete("/categorias/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  categoriaController.excluir(req, res, next)
);

// 5. Produtos (UC03)
router.get("/produtos", authMiddleware, (req, res, next) => produtoController.listar(req, res, next));
router.get("/produtos/:id", authMiddleware, (req, res, next) => produtoController.buscarPorId(req, res, next));
router.post("/produtos", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  produtoController.criar(req, res, next)
);
router.put("/produtos/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  produtoController.atualizar(req, res, next)
);
router.patch("/produtos/:id/status", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  produtoController.alterarStatus(req, res, next)
);
router.delete("/produtos/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  produtoController.excluir(req, res, next)
);

// 6. Locais Físicos / Gaveteiros (UC04)
router.get("/locais", authMiddleware, (req, res, next) => localController.listar(req, res, next));
router.get("/locais/:id", authMiddleware, (req, res, next) => localController.buscarPorId(req, res, next));
router.post("/locais", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  localController.criar(req, res, next)
);
router.put("/locais/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  localController.atualizar(req, res, next)
);
router.patch("/locais/:id/inativar", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  localController.inativar(req, res, next)
);
router.delete("/locais/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  localController.excluir(req, res, next)
);

// 7. Fornecedores (UC05)
router.get("/fornecedores", authMiddleware, (req, res, next) => fornecedorController.listar(req, res, next));
router.get("/fornecedores/:id", authMiddleware, (req, res, next) =>
  fornecedorController.buscarPorId(req, res, next)
);
router.post("/fornecedores", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  fornecedorController.criar(req, res, next)
);
router.put("/fornecedores/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  fornecedorController.atualizar(req, res, next)
);
router.post("/fornecedores/:id/produtos", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  fornecedorController.vincularProduto(req, res, next)
);
router.delete("/fornecedores/:id/produtos/:idProd", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  fornecedorController.removerVinculoProduto(req, res, next)
);

// 8. Ordens de Compra (UC06)
router.get("/ordens-compra", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ordemCompraController.listar(req, res, next)
);
router.get("/ordens-compra/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ordemCompraController.buscarPorId(req, res, next)
);
router.post("/ordens-compra", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ordemCompraController.emitir(req, res, next)
);
router.patch("/ordens-compra/:id/cancelar", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ordemCompraController.cancelar(req, res, next)
);
router.get("/ordens-compra/sugerir-itens/:idFornec", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ordemCompraController.sugerirItens(req, res, next)
);

// 9. Lotes (UC07 / UC08)
router.get("/lotes", authMiddleware, (req, res, next) => loteController.listar(req, res, next));
router.get("/lotes/:id", authMiddleware, (req, res, next) => loteController.buscarPorId(req, res, next));
router.post("/lotes/recebimento", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  loteController.receberLote(req, res, next)
);
router.put("/lotes/:id", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  loteController.atualizar(req, res, next)
);

// 10. Clientes (UC09 / LGPD RNF05)
router.get("/clientes", authMiddleware, (req, res, next) => clienteController.listar(req, res, next));
router.get("/clientes/:id", authMiddleware, (req, res, next) => clienteController.buscarPorId(req, res, next));
router.post("/clientes", authMiddleware, (req, res, next) => clienteController.criar(req, res, next));
router.put("/clientes/:id", authMiddleware, (req, res, next) => clienteController.atualizar(req, res, next));
router.post("/clientes/:id/anonimizar", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  clienteController.anonimizar(req, res, next)
);

// 11. Pedidos no Balcão (UC09)
router.get("/pedidos-venda", authMiddleware, (req, res, next) => pedidoVendaController.listar(req, res, next));
router.get("/pedidos-venda/:id", authMiddleware, (req, res, next) =>
  pedidoVendaController.buscarPorId(req, res, next)
);
router.post("/pedidos-venda", authMiddleware, (req, res, next) => pedidoVendaController.criar(req, res, next));
router.patch("/pedidos-venda/:id/cancelar", authMiddleware, (req, res, next) =>
  pedidoVendaController.cancelar(req, res, next)
);

// 12. Vendas e Caixa SAT (UC10 / UC11)
router.post("/vendas/preview-fifo", authMiddleware, (req, res, next) =>
  vendaController.previewFifo(req, res, next)
);
router.post("/vendas", authMiddleware, (req, res, next) => vendaController.registrar(req, res, next));
router.get("/vendas", authMiddleware, (req, res, next) => vendaController.listar(req, res, next));

// 13. Ajustes Manuais de Estoque (UC12)
router.get("/ajustes-estoque", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ajusteController.listar(req, res, next)
);
router.post("/ajustes-estoque", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  ajusteController.registrar(req, res, next)
);

// 14. Relatórios e Consultas (UC01 / UC02)
router.get("/relatorios/posicao-estoque", authMiddleware, (req, res, next) =>
  relatorioController.posicaoEstoque(req, res, next)
);
router.get("/relatorios/validade", authMiddleware, requireRole("PROPRIETARIO"), (req, res, next) =>
  relatorioController.controleValidade(req, res, next)
);

module.exports = router;
