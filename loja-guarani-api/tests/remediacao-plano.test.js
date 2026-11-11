const request = require("supertest");
const path = require("path");
const { execSync } = require("child_process");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { aplicarConstraintsBanco } = require("../src/lib/db-constraints");
const { gerarCPFValido } = require("../src/lib/validators");

jest.setTimeout(60000);

let tokenProprietario;
let tokenVendedor;

beforeAll(async () => {
  const apiDir = path.resolve(__dirname, "..");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe"
  });

  execSync("node prisma/seed.js", {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe"
  });

  await aplicarConstraintsBanco(prisma);

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

describe("Suite de Testes de Remediação — Plano de Não-Conformidades (TC-REM-01 a TC-REM-08)", () => {

  // =========================================================================
  // TC-REM-01: Caixa SAT — Valor Pago em Dinheiro Menor que o Total Bloqueia Venda
  // =========================================================================
  describe("Fase 4 / TC-REM-01: Caixa SAT — Pagamento em Dinheiro e Troco", () => {
    test("TC-REM-01: Venda em dinheiro com valor recebido inferior ao total deve ser rejeitada", async () => {
      // Produto 1001 (R$ 6.50)
      const prod1001 = await prisma.produto.findUnique({ where: { sku: "1001" } });

      const resFalha = await request(app)
        .post("/api/vendas")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .send({
          produtoId: prod1001.idProd,
          quantidade: 1,
          formaPagamento: "DINHEIRO",
          valorPagoEmDinheiro: 5.0, // Insuficiente para R$ 6.50
          desconto: 0
        });

      expect(resFalha.status).toBe(400);
      expect(resFalha.body.erro).toMatch(/insuficiente para o total da venda/i);
    });

    test("TC-REM-01.B: Venda em dinheiro com valor recebido suficiente deve ser aprovada e calcular troco no SAT", async () => {
      const prod1001 = await prisma.produto.findUnique({ where: { sku: "1001" } });

      const resSucesso = await request(app)
        .post("/api/vendas")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .send({
          produtoId: prod1001.idProd,
          quantidade: 1,
          formaPagamento: "DINHEIRO",
          valorPagoEmDinheiro: 10.0, // R$ 10.00 pago para total de R$ 6.50 -> Troco R$ 3.50
          desconto: 0
        });

      expect(resSucesso.status).toBe(201);
      expect(resSucesso.body.idVenda).toBeDefined();
      expect(resSucesso.body.cupomSat.xmlConteudo).toMatch(/<vTroco>3\.50<\/vTroco>/);
      expect(resSucesso.body.cupomSat.xmlConteudo).toMatch(/<vMP>10\.00<\/vMP>/);
    });
  });

  // =========================================================================
  // TC-REM-02: Consulta Estoque — SKU 1046 Vencido Exibe Saldo Livre 0 e LOTE_VENCIDO
  // =========================================================================
  describe("Fase 1 / TC-REM-02: Consistência de Estoque & Bloqueio Sanitário", () => {
    test("TC-REM-02: Consultar posição de estoque do SKU 1046 (Elástico Vencido) deve retornar saldoLivre: 0 e situacao: LOTE_VENCIDO", async () => {
      const res = await request(app)
        .get("/api/relatorios/posicao-estoque?busca=1046")
        .set("Authorization", `Bearer ${tokenVendedor}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      const item1046 = res.body.find((p) => p.sku === "1046");
      expect(item1046).toBeDefined();
      expect(item1046.estoqueTotal).toBe(6);
      expect(item1046.saldoLivre).toBe(0);
      expect(item1046.saldoFisicoDisponivel).toBe(0);
      expect(item1046.saldoVencido).toBe(6);
      expect(item1046.situacao).toBe("LOTE_VENCIDO");
    });

    test("TC-REM-02.B: Endpoint de produtos também deve reportar saldoLivre 0 para SKU 1046", async () => {
      const prod1046 = await prisma.produto.findUnique({ where: { sku: "1046" } });
      const res = await request(app)
        .get(`/api/produtos/${prod1046.idProd}`)
        .set("Authorization", `Bearer ${tokenVendedor}`);

      expect(res.status).toBe(200);
      expect(res.body.saldoLivre).toBe(0);
      expect(res.body.saldoFisicoDisponivel).toBe(0);
    });
  });

  // =========================================================================
  // TC-REM-03: Receber Lote — Data de Validade Anterior à Fabricação Rejeitada
  // =========================================================================
  describe("Fase 3 / TC-REM-03: Rastreabilidade Cronológica de Lotes", () => {
    test("TC-REM-03: Recebimento com data de validade anterior à data de fabricação deve falhar", async () => {
      const prod = await prisma.produto.findUnique({ where: { sku: "1001" } });
      const local = await prisma.local.findFirst({ where: { status: "ATIVO" } });

      const res = await request(app)
        .post("/api/lotes/recebimento")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          numLote: `LT-TEST-CHRONO-${Date.now()}`,
          idProd: prod.idProd,
          dataCompra: "2026-11-01",
          dataFabricacao: "2026-11-10",
          dataValidade: "2026-11-05", // Anterior à fabricação!
          quantidadeRecebida: 10,
          alocacoes: [{ idLocal: local.idLocal, quantidade: 10 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/data de validade não pode ser anterior à data de fabricação/i);
    });

    test("TC-REM-03.B: Atualização de lote com validade anterior à fabricação deve ser rejeitada", async () => {
      const lote = await prisma.lote.findFirst();

      const res = await request(app)
        .put(`/api/lotes/${lote.idLote}`)
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          dataFabricacao: "2026-11-10",
          dataValidade: "2026-11-02"
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/data de validade não pode ser anterior à data de fabricação/i);
    });
  });

  // =========================================================================
  // TC-REM-04: Ajuste de Estoque — Justificativas Incompatíveis com ENTRADA
  // =========================================================================
  describe("Fase 3 / TC-REM-04: Ajuste de Estoque — Validação Semântica de Justificativas", () => {
    test("TC-REM-04: Operação ENTRADA com justificativa ROUBO, QUEBRA ou VENCIMENTO deve ser rejeitada", async () => {
      const prod = await prisma.produto.findUnique({ where: { sku: "1001" }, include: { lotes: { include: { locais: true } } } });
      const lote = prod.lotes[0];
      const local = lote.locais[0];

      const resRoubo = await request(app)
        .post("/api/ajustes-estoque")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idProd: prod.idProd,
          idLote: lote.idLote,
          idLocal: local.idLocal,
          tipo: "ENTRADA",
          quantidade: 5,
          justificativa: "ROUBO", // Incompatível com ENTRADA!
          observacao: "Tentativa indevida de entrada classificada como furto"
        });

      expect(resRoubo.status).toBe(400);
      expect(resRoubo.body.erro).toMatch(/incompatível com operação de ENTRADA/i);

      const resVenc = await request(app)
        .post("/api/ajustes-estoque")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idProd: prod.idProd,
          idLote: lote.idLote,
          idLocal: local.idLocal,
          tipo: "ENTRADA",
          quantidade: 5,
          justificativa: "VENCIMENTO", // Incompatível com ENTRADA!
          observacao: "Tentativa indevida de entrada classificada como vencimento"
        });

      expect(resVenc.status).toBe(400);
      expect(resVenc.body.erro).toMatch(/incompatível com operação de ENTRADA/i);
    });

    test("TC-REM-04.B: Operação ENTRADA com justificativa INVENTARIO deve ser aceita", async () => {
      const prod = await prisma.produto.findUnique({ where: { sku: "1001" }, include: { lotes: { include: { locais: true } } } });
      const lote = prod.lotes[0];
      const local = lote.locais[0];

      const res = await request(app)
        .post("/api/ajustes-estoque")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idProd: prod.idProd,
          idLote: lote.idLote,
          idLocal: local.idLocal,
          tipo: "ENTRADA",
          quantidade: 2,
          justificativa: "INVENTARIO",
          observacao: "Sobra de inventário identificada na contagem física periódica"
        });

      expect(res.status).toBe(201);
      expect(res.body.idMov).toBeDefined();
      expect(res.body.tipo).toBe("ENTRADA");
      expect(res.body.justificativa).toBe("INVENTARIO");
    });
  });

  // =========================================================================
  // TC-REM-05: Auditoria Estoque — Reconstituição de Saldo no Zíper (25 -> 34)
  // =========================================================================
  describe("Fase 3 / TC-REM-05: Trilha de Auditoria Fidedigna", () => {
    test("TC-REM-05: Entrada de 9 un no Zíper (SKU 1008) com saldo inicial 25 deve gerar histórico 25 -> 34", async () => {
      const prodZiper = await prisma.produto.findUnique({
        where: { sku: "1008" },
        include: { lotes: { include: { locais: true } } }
      });
      const loteZiper = prodZiper.lotes[0];
      const localZiper = loteZiper.locais[0];

      // Registrar o ajuste de ENTRADA de 9 unidades
      const resAjuste = await request(app)
        .post("/api/ajustes-estoque")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idProd: prodZiper.idProd,
          idLote: loteZiper.idLote,
          idLocal: localZiper.idLocal,
          tipo: "ENTRADA",
          quantidade: 9,
          justificativa: "INVENTARIO",
          observacao: "Sobra de contagem física apurada no fechamento de inventário"
        });

      expect(resAjuste.status).toBe(201);

      // Consultar histórico de auditoria
      const resHist = await request(app)
        .get(`/api/ajustes-estoque?idProd=${prodZiper.idProd}`)
        .set("Authorization", `Bearer ${tokenProprietario}`);

      expect(resHist.status).toBe(200);
      expect(resHist.body.length).toBeGreaterThanOrEqual(2);

      // O mais recente deve ter saldoAnterior 25 e saldoPosterior 34
      const ajusteRealizado = resHist.body.find(
        (m) => m.tipo === "ENTRADA" && m.quantidade === 9 && m.observacao.includes("Sobra de contagem física")
      );

      expect(ajusteRealizado).toBeDefined();
      expect(ajusteRealizado.saldoAnterior).toBe(25);
      expect(ajusteRealizado.saldoPosterior).toBe(34);
    });
  });

  // =========================================================================
  // TC-REM-06: Pedido Balcão — Cadastro de Cliente com CPF/CNPJ Inválido Rejeitado
  // =========================================================================
  describe("Fase 2 / TC-REM-06: Validação Cadastral de Clientes", () => {
    test("TC-REM-06: Tentar cadastrar cliente com CPF '123.456.789-00' deve falhar com erro de validação", async () => {
      const res = await request(app)
        .post("/api/clientes")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .send({
          nome: "Cliente Teste CPF Invalido",
          cpfCnpj: "123.456.789-00"
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/CPF ou CNPJ inválido/i);
    });

    test("TC-REM-06.B: Cadastrar cliente com CPF válido gerado por algoritmo deve ser aceito", async () => {
      const cpfValido = gerarCPFValido();
      const res = await request(app)
        .post("/api/clientes")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .send({
          nome: "Ateliê Cliente Válido",
          cpfCnpj: cpfValido
        });

      expect(res.status).toBe(201);
      expect(res.body.idCliente).toBeDefined();
    });
  });

  // =========================================================================
  // TC-REM-07: Produtos — Código EAN Alfanumérico Rejeitado
  // =========================================================================
  describe("Fase 2 / TC-REM-07: Validação de Código EAN-13", () => {
    test("TC-REM-07: Cadastro de produto com letras no EAN deve ser rejeitado", async () => {
      const categ = await prisma.categoria.findFirst();

      const res = await request(app)
        .post("/api/produtos")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: "Produto EAN Letras Teste",
          precoPUnid: 15.5,
          idCateg: categ.idCateg,
          ean: "789ABC1234567" // Contém letras
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/Código EAN inválido/i);
    });

    test("TC-REM-07.B: Cadastro de produto com EAN numérico com tamanho incorreto deve ser rejeitado", async () => {
      const categ = await prisma.categoria.findFirst();

      const res = await request(app)
        .post("/api/produtos")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: "Produto EAN Incompleto Teste",
          precoPUnid: 15.5,
          idCateg: categ.idCateg,
          ean: "123456" // 6 dígitos (inválido)
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/Código EAN inválido/i);
    });

    test("TC-REM-07.C: Cadastro de produto com EAN-13 numérico válido deve ter sucesso", async () => {
      const categ = await prisma.categoria.findFirst();

      const res = await request(app)
        .post("/api/produtos")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: `Produto EAN Correto ${Date.now()}`,
          precoPUnid: 19.9,
          idCateg: categ.idCateg,
          ean: "7891234567890" // 13 dígitos
        });

      expect(res.status).toBe(201);
      expect(res.body.ean).toBe("7891234567890");
    });
  });

  // =========================================================================
  // TC-REM-08: Usuários — Senha Fraca e CPF de Vendedor Inválido Rejeitados
  // =========================================================================
  describe("Fase 2 / TC-REM-08: Segurança de Usuários & Integridade Cadastral", () => {
    test("TC-REM-08.A: Cadastro de usuário com senha menor que 6 caracteres deve ser rejeitado", async () => {
      const res = await request(app)
        .post("/api/usuarios")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: "Vendedor Senha Curta",
          emailLogin: `senha.curta.${Date.now()}@lojaguarani.com.br`,
          senha: "123", // Apenas 3 caracteres!
          perfil: "VENDEDOR",
          cpf: gerarCPFValido()
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/mínimo 6 caracteres/i);
    });

    test("TC-REM-08.B: Cadastro de vendedor com CPF inválido deve ser rejeitado", async () => {
      const res = await request(app)
        .post("/api/usuarios")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: "Vendedor CPF Falso",
          emailLogin: `cpf.falso.${Date.now()}@lojaguarani.com.br`,
          senha: "SenhaValida@2026",
          perfil: "VENDEDOR",
          cpf: "111.111.111-11" // CPF inválido
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(/CPF do vendedor inválido/i);
    });

    test("TC-REM-08.C: Cadastro de vendedor com CPF válido e senha forte deve ser aceito", async () => {
      const res = await request(app)
        .post("/api/usuarios")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          nome: "Vendedor Novo Válido",
          emailLogin: `vendedor.valido.${Date.now()}@lojaguarani.com.br`,
          senha: "SenhaForte@2026",
          perfil: "VENDEDOR",
          cpf: gerarCPFValido()
        });

      expect(res.status).toBe(201);
      expect(res.body.idUsuario).toBeDefined();
      expect(res.body.vendedor).toBeDefined();
    });
  });

  // =========================================================================
  // TC-REM-09: Recebimento de Múltiplos Itens em Ordem de Compra
  // =========================================================================
  describe("Recebimento Multi-Item em Ordem de Compra (OC com mais de 1 item)", () => {
    test("Deve permitir receber sequencialmente cada item da OC e atualizar status para PARCIALMENTE_ATENDIDA e ATENDIDA", async () => {
      // 1. Obter produtos e fornecedor ativo
      const resProds = await request(app)
        .get("/api/produtos")
        .set("Authorization", `Bearer ${tokenProprietario}`);
      expect(resProds.body.length).toBeGreaterThanOrEqual(2);
      const prod1 = resProds.body[0];
      const prod2 = resProds.body[1];

      const resFornecs = await request(app)
        .get("/api/fornecedores")
        .set("Authorization", `Bearer ${tokenProprietario}`);
      const fornec = resFornecs.body.find((f) => f.status === "ATIVO") || resFornecs.body[0];

      const resLocais = await request(app)
        .get("/api/locais")
        .set("Authorization", `Bearer ${tokenProprietario}`);
      const local = resLocais.body[0];

      // 2. Emitir OC com 2 itens
      const resOc = await request(app)
        .post("/api/ordens-compra")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idFornec: fornec.idFornec,
          condicoesPagto: "30 DIAS",
          itens: [
            { idProd: prod1.idProd, quantidadePedida: 10, precoUnitCompra: 5.50 },
            { idProd: prod2.idProd, quantidadePedida: 8, precoUnitCompra: 12.00 }
          ]
        });

      expect(resOc.status).toBe(201);
      const idOc = resOc.body.idOc;
      expect(resOc.body.status).toBe("AGUARDANDO_RECEBIMENTO");

      // 3. Tentar receber um produto que NÃO pertence à OC -> deve ser rejeitado
      const prodInvalido = resProds.body.find((p) => p.idProd !== prod1.idProd && p.idProd !== prod2.idProd);
      if (prodInvalido) {
        const resInvalido = await request(app)
          .post("/api/lotes/recebimento")
          .set("Authorization", `Bearer ${tokenProprietario}`)
          .send({
            idOc,
            idProd: prodInvalido.idProd,
            numLote: `LT-TEST-INV-${Date.now()}`,
            dataCompra: new Date().toISOString().slice(0, 10),
            quantidadeRecebida: 5,
            alocacoes: [{ idLocal: local.idLocal, quantidade: 5 }]
          });
        expect(resInvalido.status).toBe(400);
        expect(resInvalido.body.erro).toMatch(/não faz parte desta Ordem de Compra/i);
      }

      // 4. Receber o Item 1 da OC (10 un)
      const resReceber1 = await request(app)
        .post("/api/lotes/recebimento")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idOc,
          idProd: prod1.idProd,
          numLote: `LT-TEST-IT1-${Date.now()}`,
          dataCompra: new Date().toISOString().slice(0, 10),
          quantidadeRecebida: 10,
          alocacoes: [{ idLocal: local.idLocal, quantidade: 10 }]
        });

      expect(resReceber1.status).toBe(201);

      // Verificar que a OC agora está PARCIALMENTE_ATENDIDA
      const resOcParcial = await request(app)
        .get(`/api/ordens-compra/${idOc}`)
        .set("Authorization", `Bearer ${tokenProprietario}`);

      expect(resOcParcial.body.status).toBe("PARCIALMENTE_ATENDIDA");
      const item1 = resOcParcial.body.itens.find((it) => it.idProd === prod1.idProd);
      const item2 = resOcParcial.body.itens.find((it) => it.idProd === prod2.idProd);
      expect(item1.quantidadeRecebida).toBe(10);
      expect(item2.quantidadeRecebida).toBe(0);

      // 5. Receber o Item 2 da OC (8 un)
      const resReceber2 = await request(app)
        .post("/api/lotes/recebimento")
        .set("Authorization", `Bearer ${tokenProprietario}`)
        .send({
          idOc,
          idProd: prod2.idProd,
          numLote: `LT-TEST-IT2-${Date.now()}`,
          dataCompra: new Date().toISOString().slice(0, 10),
          quantidadeRecebida: 8,
          alocacoes: [{ idLocal: local.idLocal, quantidade: 8 }]
        });

      expect(resReceber2.status).toBe(201);

      // Verificar que a OC agora está integralmente ATENDIDA
      const resOcFinal = await request(app)
        .get(`/api/ordens-compra/${idOc}`)
        .set("Authorization", `Bearer ${tokenProprietario}`);

      expect(resOcFinal.body.status).toBe("ATENDIDA");
      const item1Final = resOcFinal.body.itens.find((it) => it.idProd === prod1.idProd);
      const item2Final = resOcFinal.body.itens.find((it) => it.idProd === prod2.idProd);
      expect(item1Final.quantidadeRecebida).toBe(10);
      expect(item2Final.quantidadeRecebida).toBe(8);
    });
  });

});
