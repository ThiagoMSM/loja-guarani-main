const request = require("supertest");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { aplicarConstraintsBanco, removerTriggerAppendOnlyParaSeed } = require("../src/lib/db-constraints");
const { updateConfig } = require("../src/config/runtime-config");

jest.setTimeout(60000);

let tokenProprietario;
let tokenVendedor;

beforeAll(async () => {
  // Garantir isolamento do banco de teste SQLite
  const apiDir = path.resolve(__dirname, "..");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe"
  });

  // Executar seed no banco de teste
  execSync("node prisma/seed.js", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe"
  });

  await aplicarConstraintsBanco(prisma);

  // Obter tokens de autenticação
  const resLoginProp = await request(app)
    .post("/api/auth/login")
    .send({ emailLogin: "roberto@lojaguarani.com.br", senha: "Guarani@1925" });
  tokenProprietario = resLoginProp.body.token;

  const resLoginVend = await request(app)
    .post("/api/auth/login")
    .send({ emailLogin: "vendedor1@lojaguarani.com.br", senha: "Balcao@2026" });
  tokenVendedor = resLoginVend.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Módulo de Segurança e Autenticação (UC13, RNF03, RNF04, RNF05, RNF10)", () => {
  test("CT-AUTH-01: Autenticação válida e bloqueio automático após 5 tentativas consecutivas", async () => {
    // 1. Criar usuário temporário para testar 5 falhas
    const emailTeste = `teste.lockout.${Date.now()}@lojaguarani.com.br`;
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        nome: "Operador Teste Lockout",
        emailLogin: emailTeste,
        senha: "SenhaValida@123",
        perfil: "VENDEDOR",
        cpf: `999.${Math.floor(100 + Math.random() * 900)}.777-88`
      });

    // 2. Errar a senha 5 vezes consecutivas
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ emailLogin: emailTeste, senha: "SenhaErrada" });
      expect(res.status).toBe(401);
    }

    // 5ª tentativa: deve bloquear a conta (HTTP 403)
    const res5 = await request(app)
      .post("/api/auth/login")
      .send({ emailLogin: emailTeste, senha: "SenhaErrada" });
    expect(res5.status).toBe(403);
    expect(res5.body.erro).toMatch(/Acesso bloqueado por segurança por 15 minutos/);

    // Tentativa com senha certa enquanto bloqueado deve continuar bloqueada
    const resCertaBloqueada = await request(app)
      .post("/api/auth/login")
      .send({ emailLogin: emailTeste, senha: "SenhaValida@123" });
    expect(resCertaBloqueada.status).toBe(403);

    // Proprietário pode desbloquear / resetar a senha
    const usuarioBanco = await prisma.usuario.findUnique({ where: { emailLogin: emailTeste } });
    const resReset = await request(app)
      .patch(`/api/usuarios/${usuarioBanco.idUsuario}/reset-senha`)
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({ novaSenha: "NovaSenha@2026" });
    expect(resReset.status).toBe(200);

    // Agora deve logar normalmente com a nova senha
    const resSucesso = await request(app)
      .post("/api/auth/login")
      .send({ emailLogin: emailTeste, senha: "NovaSenha@2026" });
    expect(resSucesso.status).toBe(200);
    expect(resSucesso.body.token).toBeDefined();
  });

  test("CT-SEG-01: Hash bcrypt no banco, RBAC restrito a PROPRIETARIO e máscara LGPD", async () => {
    // 1. Inspecionar hash da senha no banco
    const usuario = await prisma.usuario.findFirst();
    expect(usuario.senhaHash).toMatch(/^\$2[aby]\$10\$/);

    // 2. Vendedor bloqueado ao acessar rotas administrativas (HTTP 403)
    const resProd = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({ nome: "Tentativa Vendedor" });
    expect(resProd.status).toBe(403);
    expect(resProd.body.erro).toMatch(/Acesso negado: operação exclusiva do perfil PROPRIETARIO/);

    const resForn = await request(app)
      .post("/api/fornecedores")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({});
    expect(resForn.status).toBe(403);

    const resAjuste = await request(app)
      .post("/api/ajustes-estoque")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({});
    expect(resAjuste.status).toBe(403);

    // 3. Máscara de CPF do cliente para perfil VENDEDOR (LGPD RNF05)
    const resClientes = await request(app)
      .get("/api/clientes")
      .set("Authorization", `Bearer ${tokenVendedor}`);
    expect(resClientes.status).toBe(200);
    const cli = resClientes.body.find((c) => c.cpfCnpj);
    if (cli) {
      expect(cli.cpfCnpj).toMatch(/\*\*\*/);
    }

    // 4. Teste do RNF10 (horário comercial) com toggle de runtime
    updateConfig({ enforceBusinessHours: true });
    // Se estiver fora do horário da loja, deve bloquear vendedor
    const agora = new Date();
    const horaSp = agora.getUTCHours() - 3;
    if (horaSp < 10 || horaSp >= 18 || agora.getDay() === 0 || agora.getDay() === 6) {
      const resFora = await request(app)
        .post("/api/auth/login")
        .send({ emailLogin: "vendedor1@lojaguarani.com.br", senha: "Balcao@2026" });
      expect(resFora.status).toBe(403);
    }
    // Desligar toggle de volta para não afetar outros testes
    updateConfig({ enforceBusinessHours: false });
  });
});

describe("Módulo de Gerenciamento de Produtos e Categorias (UC03)", () => {
  test("CT-PROD-01 & CT-PROD-02: Cadastro com preenchimento válido vs omissão de obrigatórios", async () => {
    // Omissão de obrigatórios
    const resVazio = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({ nome: "" });
    expect(resVazio.status).toBe(400);

    // Cadastro válido com auto-SKU >= 1000
    const categ = await prisma.categoria.findFirst();
    const resValido = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        nome: "Linha de Costura 100m Branca Alvejada",
        unidMedida: "UN",
        precoPUnid: 6.5,
        qtdMinimaVenda: 1,
        estoqueMin: 10,
        idCateg: categ.idCateg,
        loteInicial: {
          quantidade: 50,
          valorCompra: 3.2
        }
      });

    expect(resValido.status).toBe(201);
    expect(Number(resValido.body.sku)).toBeGreaterThanOrEqual(1000);
    expect(resValido.body.estoqueAtual).toBe(50);
  });

  test("CT-PROD-03: Prevenção de duplicidade de código SKU", async () => {
    const categ = await prisma.categoria.findFirst();
    const resDup = await request(app)
      .post("/api/produtos")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        sku: "1001", // já existente no seed
        nome: "Produto SKU Duplicado",
        unidMedida: "UN",
        precoPUnid: 10.0,
        idCateg: categ.idCateg
      });
    expect(resDup.status).toBe(400);
    expect(resDup.body.erro).toMatch(/já está em uso/);
  });

  test("CT-PROD-04 & RN05: Edição de produto e bloqueio de exclusão física com histórico", async () => {
    const prod = await prisma.produto.findFirst({ where: { sku: "1001" } });

    // Edição
    const resEdit = await request(app)
      .put(`/api/produtos/${prod.idProd}`)
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({ nome: "Linha de Costura 100m Branca Modificada", estoqueMin: 12 });
    expect(resEdit.status).toBe(200);
    expect(resEdit.body.nome).toBe("Linha de Costura 100m Branca Modificada");
    expect(resEdit.body.estoqueMin).toBe(12);

    // Tentativa de exclusão física (deve falhar por possuir lotes e histórico — RN05)
    const resDelete = await request(app)
      .delete(`/api/produtos/${prod.idProd}`)
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resDelete.status).toBe(400);
    expect(resDelete.body.erro).toMatch(/não pode ser excluído.*Altere o status para INATIVO/);
  });
});

describe("Módulo de Locais Físicos e Fornecedores (UC04 e UC05)", () => {
  test("CT-LOC-01 & CT-LOC-02: Cadastro de gaveteiro, bloqueio de inativação com saldo e capacidade", async () => {
    // 1. Criar novo local
    const codLocal = `GAV-T-${Date.now().toString().slice(-4)}`;
    const resNovo = await request(app)
      .post("/api/locais")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        codigo: codLocal,
        capacidade: 200,
        descricao: "Gaveteiro Teste Automatizado"
      });
    expect(resNovo.status).toBe(201);
    expect(resNovo.body.capacidade).toBe(200);

    // 2. Bloqueio de inativação de local ocupado (GAV-A-01 tem estoque no seed)
    const locOcupado = await prisma.local.findUnique({ where: { codigo: "GAV-A-01" } });
    const resInativar = await request(app)
      .patch(`/api/locais/${locOcupado.idLocal}/inativar`)
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resInativar.status).toBe(400);
    expect(resInativar.body.erro).toMatch(/Não é possível inativar/);

    // 3. Local vazio pode ser inativado
    const locVazio = await prisma.local.findUnique({ where: { codigo: "GAV-VAZIO-09" } });
    const resInatVazio = await request(app)
      .patch(`/api/locais/${locVazio.idLocal}/inativar`)
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resInatVazio.status).toBe(200);
    expect(resInatVazio.body.local.status).toBe("INATIVO");
  });

  test("CT-FORN-01: Cadastro de fornecedor e validação rigorosa de CNPJ (RN08)", async () => {
    // CNPJ com dígitos verificadores inválidos
    const resInvalido = await request(app)
      .post("/api/fornecedores")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        cnpj: "11.111.111/1111-11",
        razSocial: "Fornecedor Falso"
      });
    expect(resInvalido.status).toBe(400);
    expect(resInvalido.body.erro).toMatch(/CNPJ informado é inválido/);

    // CNPJ válido já existente (duplicidade)
    const resDup = await request(app)
      .post("/api/fornecedores")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        cnpj: "60.716.586/0001-17",
        razSocial: "Tentativa Duplicada Linhas Corrente"
      });
    expect(resDup.status).toBe(400);
    expect(resDup.body.erro).toMatch(/CNPJ já cadastrado/);
  });
});

describe("Módulo de Suprimentos: Ordem de Compra e Recebimento de Lote (UC06, UC07, UC08)", () => {
  test("CT-OC-01: Emissão de OC para fornecedor ativo e bloqueio para inativo (RN09)", async () => {
    const prod = await prisma.produto.findFirst();
    const fornAtivo = await prisma.fornecedor.findFirst({ where: { status: "ATIVO" } });
    const fornInativo = await prisma.fornecedor.findFirst({ where: { status: "INATIVO" } });

    // Bloqueio para inativo
    const resInat = await request(app)
      .post("/api/ordens-compra")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        idFornec: fornInativo.idFornec,
        itens: [{ idProd: prod.idProd, quantidadePedida: 10, precoUnitCompra: 5.0 }]
      });
    expect(resInat.status).toBe(400);
    expect(resInat.body.erro).toMatch(/Selecione um fornecedor ativo/);

    // Emissão com fornecedor ativo
    const resAtivo = await request(app)
      .post("/api/ordens-compra")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        idFornec: fornAtivo.idFornec,
        itens: [{ idProd: prod.idProd, quantidadePedida: 20, precoUnitCompra: 4.5 }]
      });
    expect(resAtivo.status).toBe(201);
    expect(resAtivo.body.status).toBe("AGUARDANDO_RECEBIMENTO");
    expect(resAtivo.body.valorTotalEstimado).toBe(90.0);
  });

  test("CT-LOTE-01 & CT-LOTE-04: Recebimento de lote, validação de datas e limite de capacidade (RN07, RN10)", async () => {
    const prod = await prisma.produto.findFirst();
    const local = await prisma.local.findFirst({ where: { status: "ATIVO" } });

    // 1. Data de validade anterior à data de compra (RN10)
    const resDataInvalida = await request(app)
      .post("/api/lotes/recebimento")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        numLote: "LT-ERR-DATA",
        idProd: prod.idProd,
        dataCompra: "2026-10-10",
        dataValidade: "2026-10-01",
        quantidadeRecebida: 10,
        idLocal: local.idLocal
      });
    expect(resDataInvalida.status).toBe(400);
    expect(resDataInvalida.body.erro).toMatch(/data de validade não pode ser anterior/);

    // 2. Alocação que excede a capacidade máxima do local (RN07)
    const resCap = await request(app)
      .post("/api/lotes/recebimento")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        numLote: "LT-ERR-CAP",
        idProd: prod.idProd,
        dataCompra: "2026-10-10",
        quantidadeRecebida: 999999,
        idLocal: local.idLocal
      });
    expect(resCap.status).toBe(400);
    expect(resCap.body.erro).toMatch(/Capacidade máxima do local.*excedida/);
  });
});

describe("Módulo de Balcão e Vendas: Reserva, Baixa PEPS/FIFO, SAT e Rollback (UC09, UC10, UC11, UC14)", () => {
  test("CT-PED-01: Pedido com validação de quantidade mínima (RN13) e reserva (RN14)", async () => {
    const prodFita = await prisma.produto.findUnique({ where: { sku: "1002" } });
    const estoqueReservadoAntes = prodFita.estoqueReservado;

    // Tentativa abaixo da quantidade mínima (min = 2)
    const resAbaixoMin = await request(app)
      .post("/api/pedidos-venda")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({
        itens: [{ idProd: prodFita.idProd, quantidade: 1 }]
      });
    expect(resAbaixoMin.status).toBe(400);
    expect(resAbaixoMin.body.erro).toMatch(/inferior à quantidade mínima de venda/);

    // Pedido válido com reserva imediata
    const resValido = await request(app)
      .post("/api/pedidos-venda")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({
        reservaAtiva: true,
        itens: [{ idProd: prodFita.idProd, quantidade: 5 }]
      });
    expect(resValido.status).toBe(201);
    expect(resValido.body.status).toBe("AGUARDANDO_PAGAMENTO");

    const prodFitaAtualizado = await prisma.produto.findUnique({ where: { sku: "1002" } });
    expect(prodFitaAtualizado.estoqueReservado).toBe(estoqueReservadoAntes + 5);

    // Cancelar pedido e verificar liberação de reserva
    const resCanc = await request(app)
      .patch(`/api/pedidos-venda/${resValido.body.idPedido}/cancelar`)
      .set("Authorization", `Bearer ${tokenVendedor}`);
    expect(resCanc.status).toBe(200);

    const prodFitaPosCancel = await prisma.produto.findUnique({ where: { sku: "1002" } });
    expect(prodFitaPosCancel.estoqueReservado).toBe(estoqueReservadoAntes);
  });

  test("CT-BAIXA-01, CT-DB-01 & CT-SAT-01: Venda Multi-Lote FIFO (15 un), Rollback em falha SAT e Alerta UC14", async () => {
    // Produto 1001 possui Lote 1 (10 un) e Lote 2 (10 un), total = 20 un. Mínimo = 8.
    const prod = await prisma.produto.findUnique({
      where: { sku: "1001" },
      include: { lotes: { orderBy: { idLote: "asc" } } }
    });

    const saldoProdAntes = prod.estoqueAtual;
    const saldoLote1Antes = prod.lotes[0].quantidadeAtual;
    const saldoLote2Antes = prod.lotes[1].quantidadeAtual;

    // 1. Simular Falha SAT: deve executar Rollback integral (ACID)
    const resFalhaSat = await request(app)
      .post("/api/vendas")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({
        produtoId: prod.idProd,
        quantidade: 15,
        formaPagamento: "PIX",
        simularFalhaSat: true
      });
    expect(resFalhaSat.status).toBe(400);
    expect(resFalhaSat.body.erro).toMatch(/Falha de comunicação com o Equipamento SAT/);

    // Conferir que o banco de dados NÃO foi alterado (Rollback bem-sucedido)
    const prodAposFalha = await prisma.produto.findUnique({
      where: { sku: "1001" },
      include: { lotes: { orderBy: { idLote: "asc" } } }
    });
    expect(prodAposFalha.estoqueAtual).toBe(saldoProdAntes);
    expect(prodAposFalha.lotes[0].quantidadeAtual).toBe(saldoLote1Antes);
    expect(prodAposFalha.lotes[1].quantidadeAtual).toBe(saldoLote2Antes);

    // 2. Venda normal de 15 unidades: esgota Lote 1 (10 un), consome 5 un do Lote 2, resta 5 un
    const resVendaSucesso = await request(app)
      .post("/api/vendas")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({
        produtoId: prod.idProd,
        quantidade: 15,
        formaPagamento: "PIX"
      });

    expect(resVendaSucesso.status).toBe(201);
    expect(resVendaSucesso.body.quantidadeBaixada).toBe(15);
    expect(resVendaSucesso.body.estoqueRestanteProduto).toBe(5);
    expect(resVendaSucesso.body.alertaEstoqueMinimoAtivo).toBe(true); // 5 <= 8 (UC14 disparado!)

    // Validar consumo PEPS/FIFO nos lotes
    expect(resVendaSucesso.body.lotesConsumidos).toHaveLength(2);
    expect(resVendaSucesso.body.lotesConsumidos[0].retirado).toBe(10);
    expect(resVendaSucesso.body.lotesConsumidos[0].saldoRestante).toBe(0);
    expect(resVendaSucesso.body.lotesConsumidos[1].retirado).toBe(5);
    expect(resVendaSucesso.body.lotesConsumidos[1].saldoRestante).toBe(5);

    // Validar Cupom SAT emitido
    expect(resVendaSucesso.body.cupomSat.chaveAcesso).toHaveLength(44);
    expect(resVendaSucesso.body.cupomSat.statusSefaz).toBe("EMITIDO");
    expect(resVendaSucesso.body.cupomSat.xmlConteudo).not.toMatch(/Aviamentos Diversos/);
    expect(resVendaSucesso.body.cupomSat.xmlConteudo).toMatch(/<xProd>/);
  });

  test("CT-BAIXA-02: Bloqueio de venda acima do saldo disponível", async () => {
    const prod = await prisma.produto.findUnique({ where: { sku: "1001" } });
    const resEstoqueInsuficiente = await request(app)
      .post("/api/vendas")
      .set("Authorization", `Bearer ${tokenVendedor}`)
      .send({
        produtoId: prod.idProd,
        quantidade: 9999,
        formaPagamento: "DINHEIRO"
      });
    expect(resEstoqueInsuficiente.status).toBe(400);
    expect(resEstoqueInsuficiente.body.erro).toMatch(/Estoque insuficiente/);
  });
});

describe("Módulo de Controle de Inventário e Ajuste Manual (UC12, RN19, RN20)", () => {
  test("CT-AJUSTE-01 & CT-AJUSTE-02: Ajuste manual auditado, bloqueio sem justificativa e limite", async () => {
    const prod = await prisma.produto.findUnique({
      where: { sku: "1005" },
      include: {
        lotes: {
          include: { locais: true }
        }
      }
    });

    const lote = prod.lotes[0];
    const loc = lote.locais[0];

    // 1. Bloqueio por observação curta / sem justificativa
    const resInvalido = await request(app)
      .post("/api/ajustes-estoque")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        idProd: prod.idProd,
        idLote: lote.idLote,
        idLocal: loc.idLocal,
        tipo: "BAIXA",
        quantidade: 2,
        justificativa: "QUEBRA",
        observacao: "Curto" // Menor que 15 chars
      });
    expect(resInvalido.status).toBe(400);
    expect(resInvalido.body.erro).toMatch(/mínimo 15 caracteres/);

    // 2. Bloqueio por quantidade maior que o saldo
    const resAcimaSaldo = await request(app)
      .post("/api/ajustes-estoque")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        idProd: prod.idProd,
        idLote: lote.idLote,
        idLocal: loc.idLocal,
        tipo: "BAIXA",
        quantidade: 9999,
        justificativa: "QUEBRA",
        observacao: "Conferência de quebra excessiva no transporte"
      });
    expect(resAcimaSaldo.status).toBe(400);
    expect(resAcimaSaldo.body.erro).toMatch(/quantidade excede o saldo/);

    // 3. Ajuste válido com trilha de auditoria
    const saldoAntes = loc.quantidade;
    const resAjusteValido = await request(app)
      .post("/api/ajustes-estoque")
      .set("Authorization", `Bearer ${tokenProprietario}`)
      .send({
        idProd: prod.idProd,
        idLote: lote.idLote,
        idLocal: loc.idLocal,
        tipo: "BAIXA",
        quantidade: 2,
        justificativa: "QUEBRA",
        observacao: "Dois botões quebrados constatados na vistoria da gaveta"
      });
    expect(resAjusteValido.status).toBe(201);
    expect(resAjusteValido.body.novoSaldoLocal).toBe(saldoAntes - 2);

    // 4. Teste CT-DB-02: Trigger do SGBD rejeita UPDATE ou DELETE em movimentacoes_estoque (RN20)
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE movimentacoes_estoque SET quantidade = 999 WHERE id_mov = ${resAjusteValido.body.idMov}`
      )
    ).rejects.toThrow();

    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM movimentacoes_estoque WHERE id_mov = ${resAjusteValido.body.idMov}`
      )
    ).rejects.toThrow();
  });
});

describe("Módulo de Consultas e Relatórios (UC01, UC02, RNF02)", () => {
  test("CT-CONS-01 & CT-CONS-02: Consulta filtrada, tratamento de busca sem resultados e p95 < 3s", async () => {
    const inicio = Date.now();

    // Consulta filtrada
    const resCons = await request(app)
      .get("/api/relatorios/posicao-estoque?busca=Linha&situacao=TODOS")
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resCons.status).toBe(200);
    expect(Array.isArray(resCons.body)).toBe(true);

    const duracao = Date.now() - inicio;
    expect(duracao).toBeLessThan(3000); // RNF02: Desempenho < 3 segundos

    // Busca inexistente
    const resVazio = await request(app)
      .get("/api/relatorios/posicao-estoque?busca=SKU-99999-INEXISTENTE")
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resVazio.status).toBe(200);
    expect(resVazio.body).toHaveLength(0);
  });

  test("CT-VAL-01: Relatório de Controle de Validade com destaque para lote crítico", async () => {
    const resVal = await request(app)
      .get("/api/relatorios/validade?janela=30")
      .set("Authorization", `Bearer ${tokenProprietario}`);
    expect(resVal.status).toBe(200);
    expect(resVal.body.lotes).toBeDefined();

    // Lote LT-COLA-04 deve constar com criticidade CRITICO_30D
    const loteCola = resVal.body.lotes.find((l) => l.numLote === "LT-COLA-04");
    expect(loteCola).toBeDefined();
    expect(loteCola.criticidade).toBe("CRITICO_30D");
    expect(loteCola.diasRestantes).toBeLessThanOrEqual(30);
    expect(resVal.body.valorTotalEmRisco).toBeGreaterThan(0);
  });
});
