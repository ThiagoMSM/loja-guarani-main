const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");
const { removerTriggerAppendOnlyParaSeed, aplicarConstraintsBanco } = require("../src/lib/db-constraints");

async function main() {
  console.log("[SEED] Iniciando carga de dados da Loja Guarani...");

  // 1. Desativar temporariamente triggers para permitir limpeza idempotente
  await removerTriggerAppendOnlyParaSeed(prisma);

  // 2. Limpar dados na ordem inversa das chaves estrangeiras
  await prisma.movimentacaoEstoque.deleteMany();
  await prisma.itemVenda.deleteMany();
  await prisma.venda.deleteMany();
  await prisma.itemPedidoVenda.deleteMany();
  await prisma.pedidoVenda.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.itemOC.deleteMany();
  await prisma.ordemCompra.deleteMany();
  await prisma.loteLocal.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.produtoFornecedor.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.local.deleteMany();
  await prisma.fornecedor.deleteMany();
  await prisma.categoria.updateMany({ data: { idCategPai: null } });
  await prisma.categoria.deleteMany();
  await prisma.vendedor.deleteMany();
  await prisma.usuario.deleteMany();

  // 3. Usuários e Vendedores (com senha criptografada via bcrypt salt 10)
  const senhaProprietario = await bcrypt.hash("Guarani@1925", 10);
  const senhaVendedor = await bcrypt.hash("Balcao@2026", 10);

  const roberto = await prisma.usuario.create({
    data: {
      nome: "Roberto Camasmie",
      emailLogin: "roberto@lojaguarani.com.br",
      senhaHash: senhaProprietario,
      perfil: "PROPRIETARIO",
      status: "ATIVO"
    }
  });

  const sergio = await prisma.usuario.create({
    data: {
      nome: "Sérgio Camasmie",
      emailLogin: "sergio@lojaguarani.com.br",
      senhaHash: senhaProprietario,
      perfil: "PROPRIETARIO",
      status: "ATIVO"
    }
  });

  const vendedor1User = await prisma.usuario.create({
    data: {
      nome: "Lucas Balconista",
      emailLogin: "vendedor1@lojaguarani.com.br",
      senhaHash: senhaVendedor,
      perfil: "VENDEDOR",
      status: "ATIVO"
    }
  });

  // Vincular registros em vendedores para operadores de balcão
  const vendRoberto = await prisma.vendedor.create({
    data: {
      idUsuario: roberto.idUsuario,
      cpf: "111.222.333-44",
      cargo: "Sócio-Proprietário Operacional",
      telefone: "(11) 3227-5330",
      email: roberto.emailLogin
    }
  });

  await prisma.vendedor.create({
    data: {
      idUsuario: sergio.idUsuario,
      cpf: "222.333.444-55",
      cargo: "Sócio-Proprietário Comercial",
      telefone: "(11) 3229-6217",
      email: sergio.emailLogin
    }
  });

  const vendLucas = await prisma.vendedor.create({
    data: {
      idUsuario: vendedor1User.idUsuario,
      cpf: "333.444.555-66",
      cargo: "Vendedor Balconista",
      telefone: "(11) 99175-3046",
      email: vendedor1User.emailLogin
    }
  });

  // 4. Categorias Hierárquicas (UC03)
  const catCostura = await prisma.categoria.create({
    data: {
      codigoHierarquico: "1",
      nome: "Costura e Fios",
      descricao: "Linhas para costura doméstica, industrial e bordado"
    }
  });

  const catLinhasMaq = await prisma.categoria.create({
    data: {
      codigoHierarquico: "1.4",
      nome: "Linhas para Máquina",
      descricao: "Linhas especiais de alta resistência",
      idCategPai: catCostura.idCateg
    }
  });

  const catLinhasPoliester = await prisma.categoria.create({
    data: {
      codigoHierarquico: "1.4.6",
      nome: "Linhas 100% Poliéster",
      descricao: "Linhas de poliéster para máquina reta e overloque",
      idCategPai: catLinhasMaq.idCateg
    }
  });

  const catBotoes = await prisma.categoria.create({
    data: {
      codigoHierarquico: "2",
      nome: "Botões e Fechos",
      descricao: "Botões de madrepérola, poliéster, colchetes e fechos"
    }
  });

  const catZiperes = await prisma.categoria.create({
    data: {
      codigoHierarquico: "3",
      nome: "Zíperes e Cursores",
      descricao: "Zíperes invisíveis, fixos e destacáveis"
    }
  });

  const catFitas = await prisma.categoria.create({
    data: {
      codigoHierarquico: "4",
      nome: "Fitas, Rendas e Elásticos",
      descricao: "Fitas de cetim, gorgurão, elásticos chatos e rendas"
    }
  });

  const catColas = await prisma.categoria.create({
    data: {
      codigoHierarquico: "5",
      nome: "Colas, Tintas e Químicos",
      descricao: "Artigos perecíveis para artesanato e fixação têxtil"
    }
  });

  // 5. Locais Físicos de Armazenamento (UC04)
  const locGavA01 = await prisma.local.create({
    data: {
      codigo: "GAV-A-01",
      tipoCompartimento: "GAVETEIRO",
      capacidade: 200,
      descricao: "Balcão Principal — Gaveteiro A, Gaveta 01 (Linhas de Costura)"
    }
  });

  const locGavA02 = await prisma.local.create({
    data: {
      codigo: "GAV-A-02",
      tipoCompartimento: "GAVETEIRO",
      capacidade: 300,
      descricao: "Balcão Principal — Gaveteiro A, Gaveta 02 (Botões e Agulhas)"
    }
  });

  const locGavB04 = await prisma.local.create({
    data: {
      codigo: "GAV-B-04",
      tipoCompartimento: "GAVETEIRO",
      capacidade: 100,
      descricao: "Balcão Central — Gaveteiro B, Gaveta 04 (Colas e Elásticos)"
    }
  });

  const locPratC01 = await prisma.local.create({
    data: {
      codigo: "PRAT-C-01",
      tipoCompartimento: "PRATELEIRA",
      capacidade: 250,
      descricao: "Estante Corredor C — Prateleira 01 (Fitas e Zíperes)"
    }
  });

  await prisma.local.create({
    data: {
      codigo: "GAV-VAZIO-09",
      tipoCompartimento: "GAVETEIRO",
      capacidade: 150,
      descricao: "Gaveteiro Reserva 09 (Vazio para testes de inativação)"
    }
  });

  // 6. Fornecedores (UC05)
  const fornLinhasCorrente = await prisma.fornecedor.create({
    data: {
      cnpj: "60.716.586/0001-17",
      razSocial: "Linhas Corrente Ltda",
      nomeFantasia: "Linhas Corrente",
      contatoPrincipal: "Carlos Eduardo Silva",
      telefone: "(11) 3855-1000",
      email: "pedidos@linhascorrente.com.br",
      endereco: "Rua do Manifesto, 705 - Ipiranga, São Paulo/SP",
      condicoesPagtoPadrao: "28/56 dias boleto",
      prazoMedioDias: 5
    }
  });

  const fornPingouin = await prisma.fornecedor.create({
    data: {
      cnpj: "45.997.418/0001-53",
      razSocial: "Pingouin Fios e Lãs Ltda",
      nomeFantasia: "Pingouin Fios",
      contatoPrincipal: "Mariana Prado",
      telefone: "(11) 4588-2000",
      email: "vendas@pingouin.com.br",
      endereco: "Av. Industrial, 1200 - Jundiaí/SP",
      condicoesPagtoPadrao: "30 dias boleto",
      prazoMedioDias: 7
    }
  });

  const fornYkk = await prisma.fornecedor.create({
    data: {
      cnpj: "33.000.167/0001-01",
      razSocial: "YKK do Brasil Ltda",
      nomeFantasia: "YKK Zíperes",
      contatoPrincipal: "Roberto Tanaka",
      telefone: "(11) 2141-8000",
      email: "comercial@ykk.com.br",
      endereco: "Rua Verbo Divino, 1488 - Chácara Santo Antônio, São Paulo/SP",
      condicoesPagtoPadrao: "PIX à vista 5% desc.",
      prazoMedioDias: 4
    }
  });

  await prisma.fornecedor.create({
    data: {
      cnpj: "11.222.333/0001-81",
      razSocial: "Importadora Têxtil Antiga Ltda",
      nomeFantasia: "Têxtil Antiga",
      contatoPrincipal: "Antônio Santos",
      telefone: "(11) 3311-0000",
      email: "contato@textilantiga.com.br",
      status: "INATIVO"
    }
  });

  // 7. Produtos e Lotes (UC03 / UC07 / UC08 / UC11 / UC14)
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  // SKU 1001 — Linha de Costura Branca (2 lotes: 1 mais antigo, 1 mais recente p/ FIFO)
  const prod1001 = await prisma.produto.create({
    data: {
      sku: "1001",
      ean: "7891001001001",
      ncm: "54011012",
      cfopPadrao: "5102",
      nome: "Linha de Costura 100% Poliéster 100m Branca",
      descricao: "Linha reta para confecção em geral, cone 100m",
      unidMedida: "CONE",
      precoPUnid: 6.5,
      qtdMinimaVenda: 1,
      estoqueAtual: 20,
      estoqueReservado: 0,
      estoqueMin: 8,
      idCateg: catLinhasPoliester.idCateg
    }
  });

  await prisma.produtoFornecedor.create({
    data: {
      idProd: prod1001.idProd,
      idFornec: fornLinhasCorrente.idFornec,
      precoCustoAcordado: 3.2,
      leadTimeDias: 5
    }
  });

  // Lote 1 (Mais antigo: compra 2026-07-01, validade 2027-07-01)
  const lote1 = await prisma.lote.create({
    data: {
      numLote: "LT-2026-01",
      idProd: prod1001.idProd,
      idFornec: fornLinhasCorrente.idFornec,
      dataCompra: new Date("2026-07-01T10:00:00Z"),
      valorCompra: 3.2,
      dataValidade: new Date("2027-07-01T00:00:00Z"),
      quantidadeRecebida: 10,
      quantidadeAtual: 10,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1.idLote, idLocal: locGavA01.idLocal, quantidade: 10 }
  });

  // Lote 2 (Mais recente: compra 2026-08-01, validade 2027-08-01)
  const lote2 = await prisma.lote.create({
    data: {
      numLote: "LT-2026-02",
      idProd: prod1001.idProd,
      idFornec: fornLinhasCorrente.idFornec,
      dataCompra: new Date("2026-08-01T10:00:00Z"),
      valorCompra: 3.4,
      dataValidade: new Date("2027-08-01T00:00:00Z"),
      quantidadeRecebida: 10,
      quantidadeAtual: 10,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote2.idLote, idLocal: locGavA01.idLocal, quantidade: 10 }
  });

  // SKU 1002 — Fita de Cetim Vermelha (Qtd mínima 2 un p/ CT-PED-01)
  const prod1002 = await prisma.produto.create({
    data: {
      sku: "1002",
      ean: "7891002002002",
      ncm: "58063200",
      cfopPadrao: "5102",
      nome: "Fita de Cetim 10mm Vermelha — Rolo 10m",
      unidMedida: "ROLO",
      precoPUnid: 8.9,
      qtdMinimaVenda: 2,
      estoqueAtual: 30,
      estoqueReservado: 0,
      estoqueMin: 5,
      idCateg: catFitas.idCateg
    }
  });
  const lote1002 = await prisma.lote.create({
    data: {
      numLote: "LT-2026-03",
      idProd: prod1002.idProd,
      idFornec: fornPingouin.idFornec,
      dataCompra: new Date("2026-08-05T10:00:00Z"),
      valorCompra: 4.1,
      quantidadeRecebida: 30,
      quantidadeAtual: 30,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1002.idLote, idLocal: locPratC01.idLocal, quantidade: 30 }
  });

  // SKU 1005 — Botão de Madrepérola (p/ CT-BAIXA-01 e CT-SAT-01)
  const prod1005 = await prisma.produto.create({
    data: {
      sku: "1005",
      ncm: "96062100",
      cfopPadrao: "5102",
      nome: "Botão de Madrepérola 15mm",
      unidMedida: "PACOTE",
      precoPUnid: 0.8,
      qtdMinimaVenda: 1,
      estoqueAtual: 100,
      estoqueReservado: 0,
      estoqueMin: 15,
      idCateg: catBotoes.idCateg
    }
  });
  const lote1005 = await prisma.lote.create({
    data: {
      numLote: "LT-BOTAO-01",
      idProd: prod1005.idProd,
      dataCompra: new Date("2026-08-10T10:00:00Z"),
      valorCompra: 0.35,
      quantidadeRecebida: 100,
      quantidadeAtual: 100,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1005.idLote, idLocal: locGavA02.idLocal, quantidade: 100 }
  });

  // SKU 1008 — Zíper Invisível 30cm (p/ CT-SAT-01 multi-item)
  const prod1008 = await prisma.produto.create({
    data: {
      sku: "1008",
      ncm: "96071900",
      cfopPadrao: "5102",
      nome: "Zíper Invisível 30cm",
      unidMedida: "UN",
      precoPUnid: 4.5,
      qtdMinimaVenda: 1,
      estoqueAtual: 25,
      estoqueReservado: 0,
      estoqueMin: 10,
      idCateg: catZiperes.idCateg
    }
  });
  const lote1008 = await prisma.lote.create({
    data: {
      numLote: "LT-ZIP-01",
      idProd: prod1008.idProd,
      idFornec: fornYkk.idFornec,
      dataCompra: new Date("2026-08-12T10:00:00Z"),
      valorCompra: 1.8,
      quantidadeRecebida: 25,
      quantidadeAtual: 25,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1008.idLote, idLocal: locPratC01.idLocal, quantidade: 25 }
  });

  // SKU 1010 — Agulha Máquina Industrial (Estoque 12, min 10 -> venda de 4 un dispara UC14 p/ CT-ALERTA-01)
  const prod1010 = await prisma.produto.create({
    data: {
      sku: "1010",
      ncm: "73199000",
      cfopPadrao: "5102",
      nome: "Agulha para Máquina Industrial nº 14",
      unidMedida: "PACOTE",
      precoPUnid: 12.0,
      qtdMinimaVenda: 1,
      estoqueAtual: 12,
      estoqueReservado: 0,
      estoqueMin: 10,
      idCateg: catCostura.idCateg
    }
  });
  const lote1010 = await prisma.lote.create({
    data: {
      numLote: "LT-AGULHA-01",
      idProd: prod1010.idProd,
      dataCompra: new Date("2026-08-15T10:00:00Z"),
      valorCompra: 5.5,
      quantidadeRecebida: 12,
      quantidadeAtual: 12,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1010.idLote, idLocal: locGavA02.idLocal, quantidade: 12 }
  });

  // SKU 1015 — Linha para Pesponto (Já nasce com estoque 4 <= min 10 -> badge de alerta ativo)
  const prod1015 = await prisma.produto.create({
    data: {
      sku: "1015",
      ncm: "54011012",
      cfopPadrao: "5102",
      nome: "Linha para Pesponto Preta Forte",
      unidMedida: "CONE",
      precoPUnid: 9.5,
      qtdMinimaVenda: 1,
      estoqueAtual: 4,
      estoqueReservado: 0,
      estoqueMin: 10,
      idCateg: catLinhasPoliester.idCateg
    }
  });
  await prisma.produtoFornecedor.create({
    data: {
      idProd: prod1015.idProd,
      idFornec: fornLinhasCorrente.idFornec,
      precoCustoAcordado: 4.2,
      leadTimeDias: 5
    }
  });
  const lote1015 = await prisma.lote.create({
    data: {
      numLote: "LT-PESP-01",
      idProd: prod1015.idProd,
      idFornec: fornLinhasCorrente.idFornec,
      dataCompra: new Date("2026-08-18T10:00:00Z"),
      valorCompra: 4.2,
      quantidadeRecebida: 4,
      quantidadeAtual: 4,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1015.idLote, idLocal: locGavA01.idLocal, quantidade: 4 }
  });

  // SKU 1045 — Cola para Tecido Pano 60g (Validade para daqui a 18 dias -> CT-VAL-01)
  const dataValidade18dias = new Date(hoje);
  dataValidade18dias.setDate(dataValidade18dias.getDate() + 18);

  const prod1045 = await prisma.produto.create({
    data: {
      sku: "1045",
      ncm: "35061090",
      cfopPadrao: "5102",
      nome: "Cola para Tecido Pano 60g",
      unidMedida: "UN",
      precoPUnid: 14.9,
      qtdMinimaVenda: 1,
      estoqueAtual: 15,
      estoqueReservado: 0,
      estoqueMin: 5,
      idCateg: catColas.idCateg
    }
  });
  const lote1045 = await prisma.lote.create({
    data: {
      numLote: "LT-COLA-04",
      idProd: prod1045.idProd,
      dataCompra: new Date("2026-08-01T10:00:00Z"),
      valorCompra: 7.0,
      dataValidade: dataValidade18dias,
      quantidadeRecebida: 15,
      quantidadeAtual: 15,
      status: "DISPONIVEL"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1045.idLote, idLocal: locGavB04.idLocal, quantidade: 15 }
  });

  // SKU 1046 — Elástico Chato Cru (Validade 10 dias no passado -> lote VENCIDO)
  const dataValidadeVencida = new Date(hoje);
  dataValidadeVencida.setDate(dataValidadeVencida.getDate() - 10);

  const prod1046 = await prisma.produto.create({
    data: {
      sku: "1046",
      ncm: "58062000",
      cfopPadrao: "5102",
      nome: "Elástico Chato Cru 20mm",
      unidMedida: "ROLO",
      precoPUnid: 18.0,
      qtdMinimaVenda: 1,
      estoqueAtual: 6,
      estoqueReservado: 0,
      estoqueMin: 3,
      idCateg: catFitas.idCateg
    }
  });
  const lote1046 = await prisma.lote.create({
    data: {
      numLote: "LT-ELAST-01",
      idProd: prod1046.idProd,
      dataCompra: new Date("2026-06-01T10:00:00Z"),
      valorCompra: 8.5,
      dataValidade: dataValidadeVencida,
      quantidadeRecebida: 6,
      quantidadeAtual: 6,
      status: "VENCIDO"
    }
  });
  await prisma.loteLocal.create({
    data: { idLote: lote1046.idLote, idLocal: locGavB04.idLocal, quantidade: 6 }
  });

  // 8. Clientes (UC09 / LGPD RNF05)
  const clienteAtelie = await prisma.cliente.create({
    data: {
      nome: "Ateliê Costura Fina Bom Retiro",
      cpfCnpj: "12345678000199",
      telefone: "(11) 3222-4455",
      endereco: "Rua José Paulino, 450 - Bom Retiro, São Paulo/SP",
      email: "contato@costurafina.com.br"
    }
  });

  await prisma.cliente.create({
    data: {
      nome: "Maria Helena Alfaiataria",
      cpfCnpj: "23456789012",
      telefone: "(11) 98877-6655",
      endereco: "Rua Silva Pinto, 88 - Bom Retiro, São Paulo/SP",
      email: "maria.alfaiate@gmail.com"
    }
  });

  // 9. Ordem de Compra Aberta pronta para recebimento (UC06 / UC07)
  const ocExemplo = await prisma.ordemCompra.create({
    data: {
      idFornec: fornLinhasCorrente.idFornec,
      idUsuarioEmissor: roberto.idUsuario,
      dataEntregaPrevista: new Date("2026-11-15T00:00:00Z"),
      condicoesPagto: "28/56 dias boleto",
      valorTotalEstimado: 160.0,
      status: "AGUARDANDO_RECEBIMENTO"
    }
  });

  await prisma.itemOC.create({
    data: {
      idOc: ocExemplo.idOc,
      idProd: prod1001.idProd,
      quantidadePedida: 50,
      quantidadeRecebida: 0,
      precoUnitCompra: 3.2
    }
  });

  // 10. Pedido no Balcão em Aberto (UC09)
  const pedidoExemplo = await prisma.pedidoVenda.create({
    data: {
      idCliente: clienteAtelie.idCliente,
      idVend: vendLucas.idVend,
      reservaAtiva: true,
      status: "AGUARDANDO_PAGAMENTO"
    }
  });

  await prisma.itemPedidoVenda.create({
    data: {
      idPedido: pedidoExemplo.idPedido,
      idProd: prod1002.idProd,
      quantidade: 4,
      precoUnit: 8.9
    }
  });
  // Reservar o saldo no produto
  await prisma.produto.update({
    where: { idProd: prod1002.idProd },
    data: { estoqueReservado: 4 }
  });

  // 11. Movimentações iniciais de estoque (auditoria imutável)
  await prisma.movimentacaoEstoque.createMany({
    data: [
      {
        idLote: lote1.idLote,
        idLocal: locGavA01.idLocal,
        tipo: "ENTRADA",
        quantidade: 10,
        justificativa: "RECEBIMENTO",
        observacao: "Carga inicial de estoque",
        idUsuario: roberto.idUsuario
      },
      {
        idLote: lote2.idLote,
        idLocal: locGavA01.idLocal,
        tipo: "ENTRADA",
        quantidade: 10,
        justificativa: "RECEBIMENTO",
        observacao: "Carga inicial de estoque",
        idUsuario: roberto.idUsuario
      },
      {
        idLote: lote1005.idLote,
        idLocal: locGavA02.idLocal,
        tipo: "ENTRADA",
        quantidade: 100,
        justificativa: "RECEBIMENTO",
        observacao: "Carga inicial de estoque",
        idUsuario: sergio.idUsuario
      }
    ]
  });

  // 12. Reaplicar constraints e triggers nativas no SGBD SQLite
  await aplicarConstraintsBanco(prisma);

  console.log("[SEED] Carga inicial da Loja Guarani concluída com sucesso!");
}

main()
  .catch((e) => {
    console.error("[SEED ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
