const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class OrdemCompraService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.idFornec) {
      where.idFornec = Number(filtros.idFornec);
    }

    return prisma.ordemCompra.findMany({
      where,
      include: {
        fornecedor: true,
        emissor: { select: { idUsuario: true, nome: true, emailLogin: true } },
        itens: {
          include: { produto: true }
        },
        lotesRecebidos: true
      },
      orderBy: { dataEmissao: "desc" }
    });
  }

  async buscarPorId(idOc) {
    const oc = await prisma.ordemCompra.findUnique({
      where: { idOc: Number(idOc) },
      include: {
        fornecedor: true,
        emissor: { select: { idUsuario: true, nome: true, emailLogin: true } },
        itens: {
          include: { produto: true }
        },
        lotesRecebidos: {
          include: { locais: { include: { local: true } } }
        }
      }
    });

    if (!oc) {
      throw new ErroNaoEncontrado("Ordem de Compra não encontrada.");
    }

    return oc;
  }

  async emitir(dados, idUsuarioEmissor) {
    const { idFornec, dataEntregaPrevista, condicoesPagto, itens } = dados;

    if (!idFornec) {
      throw new ErroDeNegocio("Fornecedor é obrigatório.");
    }

    // Regra RN09: Validar fornecedor ativo
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { idFornec: Number(idFornec) }
    });

    if (!fornecedor || fornecedor.status !== "ATIVO") {
      throw new ErroDeNegocio("Selecione um fornecedor ativo para emissão da Ordem de Compra.");
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new ErroDeNegocio("A Ordem de Compra deve conter ao menos 1 item.");
    }

    let valorTotalEstimado = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const qtdPedida = Number(item.quantidadePedida || item.quantidade);
      const precoUnit = Number(item.precoUnitCompra || item.precoUnit || 0);

      if (!item.idProd || isNaN(qtdPedida) || qtdPedida <= 0) {
        throw new ErroDeNegocio("Cada item deve ter um produto válido e quantidade pedida maior que zero.");
      }

      const prod = await prisma.produto.findUnique({
        where: { idProd: Number(item.idProd) }
      });

      if (!prod) {
        throw new ErroDeNegocio(`Produto ID ${item.idProd} não encontrado.`);
      }

      const subtotal = Number((qtdPedida * precoUnit).toFixed(2));
      valorTotalEstimado += subtotal;

      itensProcessados.push({
        idProd: prod.idProd,
        quantidadePedida: qtdPedida,
        quantidadeRecebida: 0,
        precoUnitCompra: Number(precoUnit.toFixed(2))
      });
    }

    valorTotalEstimado = Number(valorTotalEstimado.toFixed(2));

    return prisma.$transaction(async (tx) => {
      const oc = await tx.ordemCompra.create({
        data: {
          idFornec: Number(idFornec),
          idUsuarioEmissor: Number(idUsuarioEmissor),
          dataEntregaPrevista: dataEntregaPrevista ? new Date(dataEntregaPrevista) : null,
          condicoesPagto: condicoesPagto || fornecedor.condicoesPagtoPadrao || "28/56 dias boleto",
          valorTotalEstimado,
          status: "AGUARDANDO_RECEBIMENTO"
        }
      });

      for (const item of itensProcessados) {
        await tx.itemOC.create({
          data: {
            idOc: oc.idOc,
            idProd: item.idProd,
            quantidadePedida: item.quantidadePedida,
            quantidadeRecebida: 0,
            precoUnitCompra: item.precoUnitCompra
          }
        });
      }

      return tx.ordemCompra.findUnique({
        where: { idOc: oc.idOc },
        include: {
          fornecedor: true,
          itens: { include: { produto: true } }
        }
      });
    });
  }

  async cancelar(idOc) {
    const oc = await this.buscarPorId(idOc);

    if (oc.status === "CANCELADA") {
      throw new ErroDeNegocio("A Ordem de Compra já está cancelada.");
    }
    if (oc.status === "ATENDIDA") {
      throw new ErroDeNegocio("Não é possível cancelar uma Ordem de Compra já totalmente atendida.");
    }

    const totalRecebido = oc.itens.reduce((acc, it) => acc + it.quantidadeRecebida, 0);
    if (totalRecebido > 0) {
      throw new ErroDeNegocio(
        `Não é possível cancelar a Ordem de Compra pois já foram recebidas ${totalRecebido} unidades de lotes.`
      );
    }

    return prisma.ordemCompra.update({
      where: { idOc: Number(idOc) },
      data: { status: "CANCELADA" }
    });
  }

  async sugerirItensPorFornecedor(idFornec) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { idFornec: Number(idFornec) },
      include: {
        produtosFornecidos: {
          include: { produto: true }
        }
      }
    });

    if (!fornecedor) {
      throw new ErroNaoEncontrado("Fornecedor não encontrado.");
    }

    // Produtos fornecidos por este fornecedor que estão com estoque_atual <= estoque_min
    const sugestoes = [];
    for (const pf of fornecedor.produtosFornecidos) {
      const prod = pf.produto;
      if (prod.status === "ATIVO" && prod.estoqueMin > 0 && prod.estoqueAtual <= prod.estoqueMin) {
        const qtdSugerida = Math.max(prod.estoqueMin * 2 - prod.estoqueAtual, 10);
        sugestoes.push({
          idProd: prod.idProd,
          sku: prod.sku,
          nome: prod.nome,
          unidMedida: prod.unidMedida,
          estoqueAtual: prod.estoqueAtual,
          estoqueMin: prod.estoqueMin,
          precoUnitCompra: pf.precoCustoAcordado || Number((prod.precoPUnid * 0.5).toFixed(2)),
          quantidadePedida: qtdSugerida
        });
      }
    }

    return sugestoes;
  }
}

module.exports = new OrdemCompraService();
