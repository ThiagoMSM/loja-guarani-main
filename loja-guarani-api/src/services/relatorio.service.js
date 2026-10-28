const prisma = require("../lib/prisma");

class RelatorioService {
  async obterResumoDashboard() {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    const em30Dias = new Date();
    em30Dias.setDate(em30Dias.getDate() + 30);

    // 1. Total de SKUs ativos
    const totalSkusAtivos = await prisma.produto.count({
      where: { status: "ATIVO" }
    });

    // 2. Vendas do dia
    const vendasHoje = await prisma.venda.findMany({
      where: {
        dataVenda: { gte: hojeInicio, lte: hojeFim },
        status: "CONFIRMADA"
      }
    });

    const valorTotalVendasHoje = vendasHoje.reduce((acc, v) => acc + v.valorTotal, 0);
    const qtdVendasHoje = vendasHoje.length;

    // 3. Produtos em alerta de estoque mínimo
    const produtosAtivos = await prisma.produto.findMany({
      where: { status: "ATIVO", estoqueMin: { gt: 0 } }
    });
    const produtosAbaixoMinimo = produtosAtivos.filter((p) => p.estoqueAtual <= p.estoqueMin).length;

    // 4. Lotes vencidos ou a vencer em 30 dias
    const lotesCriticos = await prisma.lote.count({
      where: {
        status: { in: ["DISPONIVEL", "VENCIDO"] },
        quantidadeAtual: { gt: 0 },
        dataValidade: { lte: em30Dias }
      }
    });

    // 5. Últimas 5 vendas
    const ultimasVendas = await prisma.venda.findMany({
      take: 5,
      orderBy: { dataVenda: "desc" },
      include: {
        cliente: true,
        vendedor: { include: { usuario: { select: { nome: true } } } },
        itens: { include: { produto: true } }
      }
    });

    return {
      totalSkusAtivos,
      vendasHoje: {
        valorTotal: Number(valorTotalVendasHoje.toFixed(2)),
        quantidade: qtdVendasHoje
      },
      produtosAbaixoMinimo,
      lotesCriticosValidade: lotesCriticos,
      ultimasVendas
    };
  }

  async posicaoEstoque(filtros = {}) {
    const { busca, idCateg, idLocal, situacao } = filtros;
    const where = { status: "ATIVO" };

    if (idCateg) {
      // Incluir categoria e eventuais subcategorias filhas
      const categs = await prisma.categoria.findMany({
        where: {
          OR: [{ idCateg: Number(idCateg) }, { idCategPai: Number(idCateg) }]
        },
        select: { idCateg: true }
      });
      where.idCateg = { in: categs.map((c) => c.idCateg) };
    }

    if (busca && busca.trim()) {
      const termo = busca.trim();
      where.OR = [
        { nome: { contains: termo } },
        { sku: { contains: termo } },
        { ean: { contains: termo } }
      ];
    }

    let produtos = await prisma.produto.findMany({
      where,
      include: {
        categoria: true,
        lotes: {
          where: { quantidadeAtual: { gt: 0 } },
          include: {
            fornecedor: true,
            locais: { include: { local: true } }
          },
          orderBy: [{ dataValidade: "asc" }, { dataCompra: "asc" }, { idLote: "asc" }]
        }
      },
      orderBy: { nome: "asc" }
    });

    // Filtrar por Local Físico se solicitado
    if (idLocal) {
      const localIdNum = Number(idLocal);
      produtos = produtos.filter((p) =>
        p.lotes.some((l) => l.locais.some((ll) => ll.idLocal === localIdNum && ll.quantidade > 0))
      );
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const itens = produtos.map((p) => {
      const lotesValidos = p.lotes.filter(
        (l) =>
          l.status === "DISPONIVEL" &&
          (!l.dataValidade || new Date(l.dataValidade) >= hoje)
      );
      const saldoLivre = Math.max(0, p.estoqueAtual - p.estoqueReservado);

      // Determinar situação
      let sit = "DISPONIVEL";
      if (p.estoqueAtual === 0) {
        sit = "EM_FALTA";
      } else if (p.estoqueAtual <= p.estoqueMin) {
        sit = "ABAIXO_MINIMO";
      } else if (p.estoqueReservado > 0) {
        sit = "RESERVADO";
      }

      // Locais físicos distintos
      const locaisMap = new Map();
      p.lotes.forEach((l) => {
        l.locais.forEach((ll) => {
          if (ll.local && ll.quantidade > 0) {
            const atual = locaisMap.get(ll.local.codigo) || 0;
            locaisMap.set(ll.local.codigo, atual + ll.quantidade);
          }
        });
      });

      const locaisStr =
        Array.from(locaisMap.entries())
          .map(([cod, qtd]) => `${cod} (${qtd} un)`)
          .join(", ") || "-";

      return {
        idProd: p.idProd,
        sku: p.sku,
        ean: p.ean,
        nome: p.nome,
        categoriaNome: p.categoria?.nome || "-",
        unidMedida: p.unidMedida,
        precoPUnid: p.precoPUnid,
        estoqueTotal: p.estoqueAtual,
        estoqueReservado: p.estoqueReservado,
        saldoLivre,
        estoqueMin: p.estoqueMin,
        situacao: sit,
        locaisFisicos: locaisStr,
        lotesDetalhados: p.lotes.map((l) => ({
          idLote: l.idLote,
          numLote: l.numLote,
          dataCompra: l.dataCompra,
          dataValidade: l.dataValidade,
          dataFabricacao: l.dataFabricacao,
          quantidadeAtual: l.quantidadeAtual,
          valorCompra: l.valorCompra,
          status: l.status,
          fornecedor: l.fornecedor ? l.fornecedor.razSocial : "-",
          locais: l.locais.map((ll) => ({
            codigo: ll.local.codigo,
            descricao: ll.local.descricao,
            quantidade: ll.quantidade
          }))
        }))
      };
    });

    // Filtro por Situação semântica
    if (situacao && situacao !== "TODOS") {
      return itens.filter((i) => i.situacao === situacao);
    }

    return itens;
  }

  async controleValidade(filtros = {}) {
    const { janela = "30", dataInicio, dataFim, idCateg, idFornec } = filtros;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const where = {
      quantidadeAtual: { gt: 0 },
      dataValidade: { not: null }
    };

    if (idFornec) {
      where.idFornec = Number(idFornec);
    }
    if (idCateg) {
      where.produto = { idCateg: Number(idCateg) };
    }

    if (janela === "VENCIDOS") {
      where.dataValidade = { lt: hoje };
    } else if (janela === "30") {
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 30);
      where.dataValidade = { lte: limite };
    } else if (janela === "60") {
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 60);
      where.dataValidade = { lte: limite };
    } else if (janela === "90") {
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + 90);
      where.dataValidade = { lte: limite };
    } else if (janela === "PERSONALIZADO" && dataInicio && dataFim) {
      where.dataValidade = {
        gte: new Date(dataInicio),
        lte: new Date(dataFim)
      };
    }

    const lotes = await prisma.lote.findMany({
      where,
      include: {
        produto: { include: { categoria: true } },
        fornecedor: true,
        locais: { include: { local: true } }
      },
      orderBy: { dataValidade: "asc" }
    });

    let valorTotalEmRisco = 0;
    const resultado = [];

    for (const l of lotes) {
      const dVal = new Date(l.dataValidade);
      const diffTime = dVal.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let criticidade = "NORMAL";
      if (diasRestantes <= 0) {
        criticidade = "VENCIDO";
        // Atualizar status para VENCIDO se ainda estiver DISPONIVEL
        if (l.status === "DISPONIVEL") {
          await prisma.lote.update({
            where: { idLote: l.idLote },
            data: { status: "VENCIDO" }
          });
          l.status = "VENCIDO";
        }
      } else if (diasRestantes <= 30) {
        criticidade = "CRITICO_30D";
      } else if (diasRestantes <= 90) {
        criticidade = "ATENCAO";
      }

      const valorRisco = Number((l.quantidadeAtual * l.valorCompra).toFixed(2));
      valorTotalEmRisco += valorRisco;

      const locaisStr =
        l.locais
          .filter((ll) => ll.quantidade > 0)
          .map((ll) => `${ll.local.codigo} (${ll.quantidade} un)`)
          .join(", ") || "-";

      resultado.push({
        idLote: l.idLote,
        numLote: l.numLote,
        idProd: l.idProd,
        sku: l.produto.sku,
        nomeProduto: l.produto.nome,
        categoriaNome: l.produto.categoria?.nome || "-",
        unidMedida: l.produto.unidMedida,
        fornecedorNome: l.fornecedor?.razSocial || "-",
        locaisFisicos: locaisStr,
        dataCompra: l.dataCompra,
        dataValidade: l.dataValidade,
        diasRestantes,
        criticidade,
        quantidadeAtual: l.quantidadeAtual,
        valorCompraUnit: l.valorCompra,
        valorTotalEmRisco: valorRisco,
        statusLote: l.status
      });
    }

    return {
      valorTotalEmRisco: Number(valorTotalEmRisco.toFixed(2)),
      totalLotesMonitorados: resultado.length,
      lotes: resultado
    };
  }
}

module.exports = new RelatorioService();
