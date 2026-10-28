const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");
const { limparDigitos } = require("../lib/validators");

class ProdutoService {
  async gerarProximoSku() {
    const produtos = await prisma.produto.findMany({
      select: { sku: true }
    });

    let maiorSku = 999;
    for (const p of produtos) {
      const num = parseInt(p.sku, 10);
      if (!isNaN(num) && num >= 1000 && num > maiorSku) {
        maiorSku = num;
      }
    }
    return String(maiorSku + 1);
  }

  async listar(filtros = {}) {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.idCateg) {
      where.idCateg = Number(filtros.idCateg);
    }
    if (filtros.busca) {
      const termo = filtros.busca.trim();
      where.OR = [
        { nome: { contains: termo } },
        { sku: { contains: termo } },
        { ean: { contains: termo } }
      ];
    }

    const produtos = await prisma.produto.findMany({
      where,
      include: {
        categoria: true,
        lotes: {
          include: {
            locais: {
              include: { local: true }
            }
          },
          orderBy: [{ dataValidade: "asc" }, { dataCompra: "asc" }, { idLote: "asc" }]
        },
        fornecedores: {
          include: { fornecedor: true }
        }
      },
      orderBy: { sku: "asc" }
    });

    // Calcular saldos livres e indicadores em tempo real
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return produtos.map((p) => {
      const lotesValidos = p.lotes.filter(
        (l) =>
          l.status === "DISPONIVEL" &&
          l.quantidadeAtual > 0 &&
          (!l.dataValidade || new Date(l.dataValidade) >= hoje)
      );
      const saldoFisicoDisponivel = lotesValidos.reduce((acc, l) => acc + l.quantidadeAtual, 0);
      const saldoLivre = Math.max(0, p.estoqueAtual - p.estoqueReservado);

      return {
        ...p,
        saldoFisicoDisponivel,
        saldoLivre,
        emAlertaMinimo: p.estoqueAtual <= p.estoqueMin && p.estoqueMin > 0
      };
    });
  }

  async buscarPorId(idProd) {
    const produto = await prisma.produto.findUnique({
      where: { idProd: Number(idProd) },
      include: {
        categoria: true,
        lotes: {
          include: {
            locais: { include: { local: true } },
            fornecedor: true
          },
          orderBy: [{ dataValidade: "asc" }, { dataCompra: "asc" }, { idLote: "asc" }]
        },
        fornecedores: {
          include: { fornecedor: true }
        }
      }
    });

    if (!produto) {
      throw new ErroNaoEncontrado("Produto não encontrado.");
    }

    const saldoLivre = Math.max(0, produto.estoqueAtual - produto.estoqueReservado);

    return {
      ...produto,
      saldoLivre,
      emAlertaMinimo: produto.estoqueAtual <= produto.estoqueMin && produto.estoqueMin > 0
    };
  }

  async criar(dados, idUsuario = 1) {
    let {
      sku,
      ean,
      ncm,
      cfopPadrao,
      nome,
      descricao,
      unidMedida,
      precoPUnid,
      qtdMinimaVenda,
      estoqueMin,
      idCateg,
      loteInicial
    } = dados;

    if (!nome) {
      throw new ErroDeNegocio("Nome do produto é obrigatório.");
    }
    if (precoPUnid === undefined || precoPUnid === null || Number(precoPUnid) <= 0) {
      throw new ErroDeNegocio("Preço unitário deve ser maior que zero.");
    }
    if (!idCateg) {
      throw new ErroDeNegocio("Categoria é obrigatória.");
    }

    const categ = await prisma.categoria.findUnique({
      where: { idCateg: Number(idCateg) }
    });
    if (!categ) {
      throw new ErroDeNegocio("Categoria selecionada não existe.");
    }

    // Regra RN04: Gerar ou validar código SKU interno iniciado em 1000
    if (!sku || String(sku).trim() === "") {
      sku = await this.gerarProximoSku();
    } else {
      sku = String(sku).trim();
      const existente = await prisma.produto.findUnique({
        where: { sku }
      });
      if (existente) {
        throw new ErroDeNegocio(
          "O código SKU informado já está em uso por outro produto. Informe um código único."
        );
      }
    }

    const ncmLimpo = ncm ? limparDigitos(ncm).slice(0, 8) : "54011012";
    const cfopLimpo = cfopPadrao ? limparDigitos(cfopPadrao).slice(0, 4) : "5102";

    const novoProduto = await prisma.$transaction(async (tx) => {
      const prod = await tx.produto.create({
        data: {
          sku,
          ean: ean ? String(ean).trim() : null,
          ncm: ncmLimpo,
          cfopPadrao: cfopLimpo,
          nome,
          descricao: descricao || null,
          unidMedida: unidMedida || "UN",
          precoPUnid: Number(Number(precoPUnid).toFixed(2)),
          qtdMinimaVenda: qtdMinimaVenda ? Number(qtdMinimaVenda) : 1,
          estoqueMin: estoqueMin !== undefined ? Number(estoqueMin) : 5,
          idCateg: Number(idCateg),
          status: "ATIVO"
        }
      });

      // Se houver lote de abertura inicial (ex: CT-PROD-01)
      if (loteInicial && Number(loteInicial.quantidade) > 0) {
        const qtdInicial = Number(loteInicial.quantidade);
        const valorCompra = Number(loteInicial.valorCompra || Number(precoPUnid) * 0.5);

        const loteCriado = await tx.lote.create({
          data: {
            numLote: loteInicial.numLote || `LT-${sku}-01`,
            idProd: prod.idProd,
            idFornec: loteInicial.idFornec ? Number(loteInicial.idFornec) : null,
            dataCompra: loteInicial.dataCompra ? new Date(loteInicial.dataCompra) : new Date(),
            valorCompra: Number(valorCompra.toFixed(2)),
            dataFabricacao: loteInicial.dataFabricacao ? new Date(loteInicial.dataFabricacao) : null,
            dataValidade: loteInicial.dataValidade ? new Date(loteInicial.dataValidade) : null,
            quantidadeRecebida: qtdInicial,
            quantidadeAtual: qtdInicial,
            status: "DISPONIVEL"
          }
        });

        if (loteInicial.idLocal) {
          await tx.loteLocal.create({
            data: {
              idLote: loteCriado.idLote,
              idLocal: Number(loteInicial.idLocal),
              quantidade: qtdInicial
            }
          });
        }

        await tx.produto.update({
          where: { idProd: prod.idProd },
          data: { estoqueAtual: qtdInicial }
        });

        await tx.movimentacaoEstoque.create({
          data: {
            idLote: loteCriado.idLote,
            idLocal: loteInicial.idLocal ? Number(loteInicial.idLocal) : null,
            tipo: "ENTRADA",
            quantidade: qtdInicial,
            justificativa: "RECEBIMENTO",
            observacao: "Carga inicial de estoque / abertura de produto",
            idUsuario: Number(idUsuario)
          }
        });
      }

      return tx.produto.findUnique({
        where: { idProd: prod.idProd },
        include: { categoria: true, lotes: true }
      });
    });

    return novoProduto;
  }

  async atualizar(idProd, dados) {
    await this.buscarPorId(idProd);

    if (dados.sku) {
      const skuLimpo = String(dados.sku).trim();
      const existente = await prisma.produto.findFirst({
        where: {
          sku: skuLimpo,
          idProd: { not: Number(idProd) }
        }
      });
      if (existente) {
        throw new ErroDeNegocio(
          "O código SKU informado já está em uso por outro produto. Informe um código único."
        );
      }
    }

    return prisma.produto.update({
      where: { idProd: Number(idProd) },
      data: {
        sku: dados.sku ? String(dados.sku).trim() : undefined,
        ean: dados.ean !== undefined ? (dados.ean ? String(dados.ean).trim() : null) : undefined,
        ncm: dados.ncm ? limparDigitos(dados.ncm).slice(0, 8) : undefined,
        cfopPadrao: dados.cfopPadrao ? limparDigitos(dados.cfopPadrao).slice(0, 4) : undefined,
        nome: dados.nome || undefined,
        descricao: dados.descricao !== undefined ? dados.descricao : undefined,
        unidMedida: dados.unidMedida || undefined,
        precoPUnid: dados.precoPUnid !== undefined ? Number(Number(dados.precoPUnid).toFixed(2)) : undefined,
        qtdMinimaVenda: dados.qtdMinimaVenda !== undefined ? Number(dados.qtdMinimaVenda) : undefined,
        estoqueMin: dados.estoqueMin !== undefined ? Number(dados.estoqueMin) : undefined,
        idCateg: dados.idCateg ? Number(dados.idCateg) : undefined,
        status: dados.status || undefined
      }
    });
  }

  async alterarStatus(idProd, status) {
    const permitidos = ["ATIVO", "INATIVO"];
    if (!permitidos.includes(status)) {
      throw new ErroDeNegocio("Status deve ser ATIVO ou INATIVO.");
    }
    return prisma.produto.update({
      where: { idProd: Number(idProd) },
      data: { status }
    });
  }

  async excluir(idProd) {
    const produto = await prisma.produto.findUnique({
      where: { idProd: Number(idProd) },
      include: {
        _count: {
          select: {
            lotes: true,
            itensOc: true,
            itensPedido: true,
            itensVenda: true
          }
        }
      }
    });

    if (!produto) {
      throw new ErroNaoEncontrado("Produto não encontrado.");
    }

    // Regra RN05: Impedir exclusão física de qualquer produto que possua saldo ou histórico
    const possuiHistorico =
      produto.estoqueAtual > 0 ||
      produto._count.lotes > 0 ||
      produto._count.itensOc > 0 ||
      produto._count.itensPedido > 0 ||
      produto._count.itensVenda > 0;

    if (possuiHistorico) {
      throw new ErroDeNegocio(
        "Produto não pode ser excluído, pois possui saldo ou histórico de movimentação. Altere o status para INATIVO."
      );
    }

    return prisma.produto.delete({
      where: { idProd: Number(idProd) }
    });
  }
}

module.exports = new ProdutoService();
