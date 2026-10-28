const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");
const satFiscalService = require("./sat-fiscal.service");

class VendaService {
  ordenarLotesFifo(lotes) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return [...lotes].sort((a, b) => {
      // Prioridade 1: Lotes com data de validade mais próxima (FEFO)
      // Lotes sem validade vão para o fim (NULLS LAST)
      if (a.dataValidade && b.dataValidade) {
        const diffVal = new Date(a.dataValidade).getTime() - new Date(b.dataValidade).getTime();
        if (diffVal !== 0) return diffVal;
      } else if (a.dataValidade && !b.dataValidade) {
        return -1;
      } else if (!a.dataValidade && b.dataValidade) {
        return 1;
      }

      // Prioridade 2: Data de compra mais antiga (FIFO)
      const diffCompra = new Date(a.dataCompra).getTime() - new Date(b.dataCompra).getTime();
      if (diffCompra !== 0) return diffCompra;

      // Desempate estável: ID do lote
      return a.idLote - b.idLote;
    });
  }

  async previewFifo(itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new ErroDeNegocio("Informe ao menos um item para calcular o preview FIFO.");
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const resultado = [];

    for (const item of itens) {
      const idProd = Number(item.idProd || item.produtoId);
      const qtdDesejada = Number(item.quantidade);

      const produto = await prisma.produto.findUnique({
        where: { idProd },
        include: {
          lotes: {
            where: {
              status: "DISPONIVEL",
              quantidadeAtual: { gt: 0 }
            },
            include: {
              locais: { include: { local: true } }
            }
          }
        }
      });

      if (!produto) {
        throw new ErroNaoEncontrado(`Produto ID ${idProd} não encontrado.`);
      }

      const lotesNaoVencidos = produto.lotes.filter(
        (l) => !l.dataValidade || new Date(l.dataValidade) >= hoje
      );
      const lotesOrdenados = this.ordenarLotesFifo(lotesNaoVencidos);

      let restante = qtdDesejada;
      const lotesPrevistos = [];

      for (const lote of lotesOrdenados) {
        if (restante <= 0) break;
        const retirar = Math.min(lote.quantidadeAtual, restante);
        lotesPrevistos.push({
          idLote: lote.idLote,
          numLote: lote.numLote,
          dataCompra: lote.dataCompra,
          dataValidade: lote.dataValidade,
          quantidadeDisponivel: lote.quantidadeAtual,
          quantidadeRetirar: retirar,
          saldoAposVenda: lote.quantidadeAtual - retirar,
          locais: lote.locais.map((ll) => ({
            idLocal: ll.idLocal,
            codigoLocal: ll.local.codigo,
            quantidadeLocal: ll.quantidade
          }))
        });
        restante -= retirar;
      }

      resultado.push({
        idProd: produto.idProd,
        sku: produto.sku,
        nome: produto.nome,
        quantidadeSolicitada: qtdDesejada,
        saldoSuficiente: restante === 0,
        deficit: Math.max(0, restante),
        lotesPrevistos
      });
    }

    return resultado;
  }

  async registrarVenda(payload, usuarioLogado = {}) {
    // Normalizar payload (suporta tanto { produtoId, quantidade, formaPagamento } quanto { itens: [...] })
    let itensEntrada = [];
    if (payload.itens && Array.isArray(payload.itens)) {
      itensEntrada = payload.itens;
    } else if (payload.produtoId) {
      itensEntrada = [
        {
          idProd: Number(payload.produtoId),
          quantidade: Number(payload.quantidade)
        }
      ];
    } else {
      throw new ErroDeNegocio("Informe os itens da venda.");
    }

    if (itensEntrada.length === 0) {
      throw new ErroDeNegocio("A venda deve conter ao menos um item.");
    }

    const {
      idPedido,
      idCliente,
      cpfCnpjNota,
      formaPagamento = "PIX",
      desconto = 0,
      simularFalhaSat = false
    } = payload;

    const descontoNum = Number(Number(desconto || 0).toFixed(2));
    if (descontoNum < 0) {
      throw new ErroDeNegocio("Desconto não pode ser negativo.");
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Resolver ID do vendedor
    let idVend = usuarioLogado.idVend;
    if (!idVend) {
      if (usuarioLogado.idUsuario) {
        const v = await prisma.vendedor.findFirst({
          where: { idUsuario: usuarioLogado.idUsuario }
        });
        if (v) idVend = v.idVend;
      }
      if (!idVend) {
        const primeiroVend = await prisma.vendedor.findFirst();
        if (primeiroVend) idVend = primeiroVend.idVend;
      }
      if (!idVend) {
        // Fallback garantido
        const autoVend = await prisma.vendedor.create({
          data: {
            idUsuario: usuarioLogado.idUsuario || 1,
            cpf: "000.000.000-00",
            cargo: "Operador de Balcão",
            email: "balcao@lojaguarani.com.br"
          }
        });
        idVend = autoVend.idVend;
      }
    }

    // Transação Atômica ACID Completa (RN17 / RNF07)
    return prisma.$transaction(async (tx) => {
      // 1. Se vinculada a um Pedido Prévio (UC09 / UC10-A1), tratar liberação de reserva
      let pedidoVinculado = null;
      if (idPedido) {
        pedidoVinculado = await tx.pedidoVenda.findUnique({
          where: { idPedido: Number(idPedido) },
          include: { itens: true }
        });

        if (!pedidoVinculado) {
          throw new ErroNaoEncontrado("Pedido de venda vinculado não encontrado.");
        }
        if (pedidoVinculado.status !== "AGUARDANDO_PAGAMENTO") {
          throw new ErroDeNegocio(
            `Pedido #${idPedido} não está aguardando pagamento (status: ${pedidoVinculado.status}).`
          );
        }

        // Liberar reserva do pedido antes da baixa física dos lotes
        if (pedidoVinculado.reservaAtiva) {
          for (const itPed of pedidoVinculado.itens) {
            await tx.produto.update({
              where: { idProd: itPed.idProd },
              data: {
                estoqueReservado: { decrement: itPed.quantidade }
              }
            });
          }
        }

        await tx.pedidoVenda.update({
          where: { idPedido: pedidoVinculado.idPedido },
          data: { status: "FATURADO" }
        });
      }

      const itensFiscaisDetalhados = [];
      const todosLotesConsumidos = [];
      const alertasGerados = [];
      let subtotalVenda = 0;
      let produtoIdUnico = null;
      let skuUnico = null;
      let nomeUnico = null;
      let ncmUnico = null;
      let qtdTotalBaixada = 0;
      let novoEstoqueUltimoProduto = 0;

      // 2. Processar cada item vendido aplicando PEPS/FIFO (UC11)
      for (const item of itensEntrada) {
        const idProd = Number(item.idProd || item.produtoId);
        const qtdVenda = Number(item.quantidade);

        if (!idProd || !Number.isInteger(qtdVenda) || qtdVenda <= 0) {
          throw new ErroDeNegocio("Informe um produtoId válido e uma quantidade inteira maior que zero.");
        }

        const produto = await tx.produto.findUnique({
          where: { idProd },
          include: {
            lotes: {
              where: {
                status: "DISPONIVEL",
                quantidadeAtual: { gt: 0 }
              },
              include: {
                locais: {
                  where: { quantidade: { gt: 0 } },
                  orderBy: { idLocal: "asc" }
                }
              }
            }
          }
        });

        if (!produto || produto.status !== "ATIVO") {
          throw new ErroDeNegocio("Produto de aviamento não encontrado no catálogo ou inativo.");
        }

        // Salvar referências para retornos simples
        produtoIdUnico = produto.idProd;
        skuUnico = produto.sku;
        nomeUnico = produto.nome;
        ncmUnico = produto.ncm;
        qtdTotalBaixada += qtdVenda;

        // Filtrar e ordenar lotes elegíveis não-vencidos
        const lotesNaoVencidos = produto.lotes.filter(
          (l) => !l.dataValidade || new Date(l.dataValidade) >= hoje
        );
        const lotesOrdenados = this.ordenarLotesFifo(lotesNaoVencidos);

        const saldoFisicoDisponivel = lotesOrdenados.reduce(
          (acc, l) => acc + l.quantidadeAtual,
          0
        );

        // Regra RN15: Validar saldo livre suficiente
        const saldoLivreReal = Math.max(0, saldoFisicoDisponivel - produto.estoqueReservado);
        if (saldoLivreReal < qtdVenda) {
          throw new ErroDeNegocio(
            `Estoque insuficiente para '${produto.nome}'. Saldo disponível: ${saldoLivreReal}, solicitado: ${qtdVenda}. Transação revertida.`
          );
        }

        // Baixa iterativa por Lote e Local Físico (UC11)
        let restante = qtdVenda;
        for (const lote of lotesOrdenados) {
          if (restante <= 0) break;

          const retirar = Math.min(lote.quantidadeAtual, restante);
          const novoSaldoLote = lote.quantidadeAtual - retirar;
          const statusNovoLote = novoSaldoLote === 0 ? "ESGOTADO" : "DISPONIVEL";

          await tx.lote.update({
            where: { idLote: lote.idLote },
            data: {
              quantidadeAtual: novoSaldoLote,
              status: statusNovoLote
            }
          });

          // Baixar proporcionalmente dos locais físicos vinculados (lote_local)
          let restanteAlocLote = retirar;
          if (lote.locais && lote.locais.length > 0) {
            for (const locAloc of lote.locais) {
              if (restanteAlocLote <= 0) break;
              const retirarLocal = Math.min(locAloc.quantidade, restanteAlocLote);
              const novoSaldoLocal = locAloc.quantidade - retirarLocal;

              await tx.loteLocal.update({
                where: {
                  idLote_idLocal: {
                    idLote: lote.idLote,
                    idLocal: locAloc.idLocal
                  }
                },
                data: { quantidade: novoSaldoLocal }
              });

              // Gravar trilha de auditoria imutável (RN20) com local físico
              await tx.movimentacaoEstoque.create({
                data: {
                  idLote: lote.idLote,
                  idLocal: locAloc.idLocal,
                  tipo: "BAIXA",
                  quantidade: retirarLocal,
                  justificativa: "VENDA",
                  observacao: `Venda de aviamento - Saída FIFO lote ${lote.numLote}`,
                  idUsuario: Number(usuarioLogado.idUsuario || 1)
                }
              });

              restanteAlocLote -= retirarLocal;
            }
          } else {
            // Caso lote não possua vínculo com lote_local
            await tx.movimentacaoEstoque.create({
              data: {
                idLote: lote.idLote,
                idLocal: null,
                tipo: "BAIXA",
                quantidade: retirar,
                justificativa: "VENDA",
                observacao: `Venda de aviamento - Saída FIFO lote ${lote.numLote}`,
                idUsuario: Number(usuarioLogado.idUsuario || 1)
              }
            });
          }

          todosLotesConsumidos.push({
            loteId: lote.idLote,
            idLote: lote.idLote,
            numLote: lote.numLote,
            retirado: retirar,
            saldoRestante: novoSaldoLote
          });

          restante -= retirar;
        }

        if (restante > 0) {
          throw new ErroDeNegocio(
            "Inconsistência de saldo entre lotes. Operação cancelada via Rollback."
          );
        }

        // Atualizar saldo consolidado do produto
        const novoEstoque = produto.estoqueAtual - qtdVenda;
        novoEstoqueUltimoProduto = novoEstoque;

        await tx.produto.update({
          where: { idProd: produto.idProd },
          data: { estoqueAtual: novoEstoque }
        });

        // Subtotal do item
        const precoUnit = Number(item.precoUnit || produto.precoPUnid);
        const subtotalItem = Number((qtdVenda * precoUnit).toFixed(2));
        subtotalVenda += subtotalItem;

        itensFiscaisDetalhados.push({
          idProd: produto.idProd,
          sku: produto.sku,
          nome: produto.nome,
          ncm: produto.ncm,
          cfop: produto.cfopPadrao,
          unidMedida: produto.unidMedida,
          quantidade: qtdVenda,
          precoUnitPratic: precoUnit
        });

        // Verificar gatilho de Estoque Mínimo (UC14 / RF24)
        if (novoEstoque <= produto.estoqueMin && produto.estoqueMin > 0) {
          alertasGerados.push({
            idProd: produto.idProd,
            sku: produto.sku,
            nome: produto.nome,
            estoqueAtual: novoEstoque,
            estoqueMin: produto.estoqueMin,
            criticidade: novoEstoque === 0 ? "CRITICO" : "ALERTA"
          });
        }
      }

      if (descontoNum >= subtotalVenda) {
        throw new ErroDeNegocio("O desconto não pode ser maior ou igual ao subtotal da venda.");
      }

      const valorTotalFinal = Number((subtotalVenda - descontoNum).toFixed(2));

      // 3. Emissão Fiscal SAT (Portaria CAT 147/2012 — RF18 / RNF06)
      // Se simularFalhaSat for true, a função lançará ErroDeNegocio e o Prisma executará Rollback total!
      const cupomSat = await satFiscalService.emitirCupomFiscal({
        itensDetalhados: itensFiscaisDetalhados,
        valorTotal: valorTotalFinal,
        desconto: descontoNum,
        formaPagamento,
        cpfCnpjNota,
        simularFalhaSat
      });

      // 4. Persistir registro de venda e itens por lote
      const venda = await tx.venda.create({
        data: {
          idPedido: idPedido ? Number(idPedido) : null,
          idCliente: idCliente ? Number(idCliente) : null,
          idVend: Number(idVend),
          cpfCnpjNota: cpfCnpjNota ? String(cpfCnpjNota).trim() : null,
          formaPagamento,
          desconto: descontoNum,
          valorTotal: valorTotalFinal,
          numeroCupomSat: cupomSat.numeroCupomSat,
          chaveAcessoSat: cupomSat.chaveAcessoSat,
          xmlSatStatus: cupomSat.xmlSatStatus,
          xmlSatConteudo: cupomSat.xmlConteudo,
          status: "CONFIRMADA"
        }
      });

      for (const loteConsumido of todosLotesConsumidos) {
        const itemFiscal = itensFiscaisDetalhados.find((it) => it.idProd === loteConsumido.idProd);
        await tx.itemVenda.create({
          data: {
            idVenda: venda.idVenda,
            idLote: loteConsumido.idLote,
            idProd: loteConsumido.idProd || produtoIdUnico,
            quantidade: loteConsumido.retirado,
            precoUnitPratic: itemFiscal ? itemFiscal.precoUnitPratic : 0,
            cfopAplicado: itemFiscal ? itemFiscal.cfop : "5102",
            ncmAplicado: itemFiscal ? itemFiscal.ncm : "54011012"
          }
        });
      }

      const alertaEstoqueMinimoAtivo = alertasGerados.length > 0;

      return {
        vendaId: venda.idVenda,
        idVenda: venda.idVenda,
        produtoId: produtoIdUnico,
        sku: skuUnico,
        produtoNome: nomeUnico,
        ncmFiscal: ncmUnico,
        quantidadeBaixada: qtdTotalBaixada,
        valorTotal: valorTotalFinal,
        estoqueRestanteProduto: novoEstoqueUltimoProduto,
        alertaEstoqueMinimoAtivo,
        alertasGerados,
        lotesConsumidos: todosLotesConsumidos,
        cupomSat: {
          numeroCupom: cupomSat.numeroCupomSat,
          chaveAcesso: cupomSat.chaveAcessoSat,
          itemDiscriminadoXml: cupomSat.itemDiscriminadoXml,
          statusSefaz: "EMITIDO",
          xmlConteudo: cupomSat.xmlConteudo
        }
      };
    });
  }

  async listarVendas(filtros = {}) {
    const where = {};
    if (filtros.dataInicio && filtros.dataFim) {
      where.dataVenda = {
        gte: new Date(filtros.dataInicio),
        lte: new Date(filtros.dataFim)
      };
    }

    return prisma.venda.findMany({
      where,
      include: {
        cliente: true,
        vendedor: {
          include: { usuario: { select: { nome: true } } }
        },
        itens: {
          include: {
            produto: true,
            lote: true
          }
        }
      },
      orderBy: { dataVenda: "desc" }
    });
  }
}

module.exports = new VendaService();
