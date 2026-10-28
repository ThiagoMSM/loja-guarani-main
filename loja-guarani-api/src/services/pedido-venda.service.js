const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class PedidoVendaService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.idVend) {
      where.idVend = Number(filtros.idVend);
    }

    return prisma.pedidoVenda.findMany({
      where,
      include: {
        cliente: true,
        vendedor: {
          include: { usuario: { select: { nome: true, emailLogin: true } } }
        },
        itens: {
          include: { produto: true }
        }
      },
      orderBy: { dataPedido: "desc" }
    });
  }

  async buscarPorId(idPedido) {
    const pedido = await prisma.pedidoVenda.findUnique({
      where: { idPedido: Number(idPedido) },
      include: {
        cliente: true,
        vendedor: {
          include: { usuario: { select: { nome: true, emailLogin: true } } }
        },
        itens: {
          include: {
            produto: {
              include: {
                lotes: {
                  where: { status: "DISPONIVEL", quantidadeAtual: { gt: 0 } },
                  include: { locais: { include: { local: true } } }
                }
              }
            }
          }
        }
      }
    });

    if (!pedido) {
      throw new ErroNaoEncontrado("Pedido de venda não encontrado.");
    }

    return pedido;
  }

  async criar(dados, usuarioLogado) {
    const { idCliente, reservaAtiva = true, itens } = dados;

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new ErroDeNegocio("O pedido no balcão deve conter ao menos 1 item.");
    }

    // Resolver vendedor responsável
    let idVend = usuarioLogado.idVend;
    if (!idVend) {
      // Se o usuário logado for Proprietário sem perfil vendedor, buscar ou vincular
      let vend = await prisma.vendedor.findFirst({
        where: { idUsuario: usuarioLogado.idUsuario }
      });
      if (!vend) {
        vend = await prisma.vendedor.findFirst();
      }
      if (!vend) {
        throw new ErroDeNegocio("Nenhum vendedor cadastrado no sistema para associar ao pedido.");
      }
      idVend = vend.idVend;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return prisma.$transaction(async (tx) => {
      const itensValidados = [];

      for (const item of itens) {
        const idProd = Number(item.idProd || item.produtoId);
        const qtd = Number(item.quantidade);

        if (!idProd || isNaN(qtd) || qtd <= 0) {
          throw new ErroDeNegocio("Item inválido ou quantidade menor ou igual a zero.");
        }

        const produto = await tx.produto.findUnique({
          where: { idProd },
          include: {
            lotes: {
              where: {
                status: "DISPONIVEL",
                quantidadeAtual: { gt: 0 }
              }
            }
          }
        });

        if (!produto || produto.status !== "ATIVO") {
          throw new ErroDeNegocio(`Produto ID ${idProd} não encontrado ou inativo.`);
        }

        // Regra RN13: Bloquear a adição de item caso a quantidade solicitada seja inferior a qtd_minima_venda
        if (qtd < produto.qtdMinimaVenda) {
          throw new ErroDeNegocio(
            `Quantidade solicitada (${qtd}) inferior à quantidade mínima de venda (${produto.qtdMinimaVenda} ${produto.unidMedida}) para '${produto.nome}'.`
          );
        }

        // Validar saldo livre vendável
        const lotesValidos = produto.lotes.filter(
          (l) => !l.dataValidade || new Date(l.dataValidade) >= hoje
        );
        const saldoFisico = lotesValidos.reduce((acc, l) => acc + l.quantidadeAtual, 0);
        const saldoLivre = Math.max(0, saldoFisico - produto.estoqueReservado);

        if (qtd > saldoLivre) {
          throw new ErroDeNegocio(
            `Estoque insuficiente para '${produto.nome}'. Saldo livre disponível: ${saldoLivre}, solicitado: ${qtd}.`
          );
        }

        const precoUnit = Number(item.precoUnit || produto.precoPUnid);
        itensValidados.push({
          idProd: produto.idProd,
          quantidade: qtd,
          precoUnit: Number(precoUnit.toFixed(2))
        });

        // Regra RN14: Reserva incrementa estoque_reservado reduzindo saldo livre para novos pedidos
        if (reservaAtiva) {
          await tx.produto.update({
            where: { idProd: produto.idProd },
            data: {
              estoqueReservado: { increment: qtd }
            }
          });
        }
      }

      const pedido = await tx.pedidoVenda.create({
        data: {
          idCliente: idCliente ? Number(idCliente) : null,
          idVend: Number(idVend),
          reservaAtiva: Boolean(reservaAtiva),
          status: "AGUARDANDO_PAGAMENTO"
        }
      });

      for (const item of itensValidados) {
        await tx.itemPedidoVenda.create({
          data: {
            idPedido: pedido.idPedido,
            idProd: item.idProd,
            quantidade: item.quantidade,
            precoUnit: item.precoUnit
          }
        });
      }

      return tx.pedidoVenda.findUnique({
        where: { idPedido: pedido.idPedido },
        include: {
          cliente: true,
          itens: { include: { produto: true } }
        }
      });
    });
  }

  async cancelar(idPedido) {
    const pedido = await this.buscarPorId(idPedido);

    if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
      throw new ErroDeNegocio(
        `Apenas pedidos com status AGUARDANDO_PAGAMENTO podem ser cancelados. Status atual: ${pedido.status}`
      );
    }

    return prisma.$transaction(async (tx) => {
      // Liberar reserva se estiver ativa
      if (pedido.reservaAtiva) {
        for (const item of pedido.itens) {
          await tx.produto.update({
            where: { idProd: item.idProd },
            data: {
              estoqueReservado: { decrement: item.quantidade }
            }
          });
        }
      }

      return tx.pedidoVenda.update({
        where: { idPedido: Number(idPedido) },
        data: {
          status: "CANCELADO",
          reservaAtiva: false
        }
      });
    });
  }
}

module.exports = new PedidoVendaService();
