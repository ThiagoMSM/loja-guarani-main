const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class LoteService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.idProd) {
      where.idProd = Number(filtros.idProd);
    }
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.busca) {
      const termo = filtros.busca.trim();
      where.OR = [
        { numLote: { contains: termo } },
        { numeroNf: { contains: termo } },
        { produto: { nome: { contains: termo } } },
        { produto: { sku: { contains: termo } } }
      ];
    }

    return prisma.lote.findMany({
      where,
      include: {
        produto: { include: { categoria: true } },
        fornecedor: true,
        ordemCompra: true,
        locais: {
          include: { local: true }
        }
      },
      orderBy: [{ dataValidade: "asc" }, { dataCompra: "asc" }, { idLote: "asc" }]
    });
  }

  async buscarPorId(idLote) {
    const lote = await prisma.lote.findUnique({
      where: { idLote: Number(idLote) },
      include: {
        produto: { include: { categoria: true } },
        fornecedor: true,
        ordemCompra: true,
        locais: {
          include: { local: true }
        },
        movimentacoes: {
          include: {
            usuario: { select: { idUsuario: true, nome: true } },
            local: true
          },
          orderBy: { dataHora: "desc" }
        }
      }
    });

    if (!lote) {
      throw new ErroNaoEncontrado("Lote não encontrado.");
    }

    return lote;
  }

  async receberLote(dados, idUsuario) {
    const {
      numLote,
      idProd,
      idFornec,
      idOc,
      numeroNf,
      dataCompra,
      valorCompra,
      dataFabricacao,
      dataValidade,
      quantidadeRecebida,
      idLocal,
      alocacoes
    } = dados;

    if (!numLote || !idProd || !quantidadeRecebida) {
      throw new ErroDeNegocio("Número do lote, produto e quantidade recebida são obrigatórios.");
    }

    const qtdRecebidaNum = Number(quantidadeRecebida);
    if (isNaN(qtdRecebidaNum) || qtdRecebidaNum <= 0) {
      throw new ErroDeNegocio("A quantidade recebida deve ser um número inteiro maior que zero.");
    }

    const dCompra = dataCompra ? new Date(dataCompra) : new Date();
    const dValidade = dataValidade ? new Date(dataValidade) : null;
    const dFabricacao = dataFabricacao ? new Date(dataFabricacao) : null;

    // Regra RN10: A data_validade (quando informada) deve ser maior ou igual à data_compra e à data_fabricacao
    if (dValidade) {
      if (dValidade < dCompra) {
        throw new ErroDeNegocio(
          "A data de validade não pode ser anterior à data de compra/fabricação do lote."
        );
      }
      if (dFabricacao && dValidade < dFabricacao) {
        throw new ErroDeNegocio(
          "A data de validade não pode ser anterior à data de compra/fabricação do lote."
        );
      }
    }

    const produto = await prisma.produto.findUnique({
      where: { idProd: Number(idProd) }
    });
    if (!produto) {
      throw new ErroDeNegocio("Produto selecionado não existe.");
    }

    // Normalizar alocações de locais físicos (UC08)
    let listaAlocacoes = [];
    if (Array.isArray(alocacoes) && alocacoes.length > 0) {
      listaAlocacoes = alocacoes;
    } else if (idLocal) {
      listaAlocacoes = [{ idLocal: Number(idLocal), quantidade: qtdRecebidaNum }];
    } else {
      throw new ErroDeNegocio("Informe ao menos um local físico (gaveteiro) para estocar o lote.");
    }

    const somaAlocacoes = listaAlocacoes.reduce((acc, a) => acc + Number(a.quantidade || 0), 0);
    if (somaAlocacoes !== qtdRecebidaNum) {
      throw new ErroDeNegocio(
        `A soma das quantidades alocadas nos gaveteiros (${somaAlocacoes}) difere da quantidade total recebida (${qtdRecebidaNum}).`
      );
    }

    // Validar capacidade de cada local físico (RN07)
    for (const aloc of listaAlocacoes) {
      const local = await prisma.local.findUnique({
        where: { idLocal: Number(aloc.idLocal) },
        include: { lotesAlocados: true }
      });

      if (!local || local.status !== "ATIVO") {
        throw new ErroDeNegocio(`Local físico ID ${aloc.idLocal} não encontrado ou inativo.`);
      }

      const ocupacaoAtual = local.lotesAlocados.reduce((acc, ll) => acc + ll.quantidade, 0);
      const qtdAlocar = Number(aloc.quantidade);

      if (ocupacaoAtual + qtdAlocar > local.capacidade) {
        const livre = Math.max(0, local.capacidade - ocupacaoAtual);
        throw new ErroDeNegocio(
          `Capacidade máxima do local ${local.codigo} excedida (Livre: ${livre} un; Solicitado: ${qtdAlocar} un). Selecione outro gaveteiro ou distribua o lote.`
        );
      }
    }

    // Validação da Ordem de Compra prévia caso informada
    let oc = null;
    if (idOc) {
      oc = await prisma.ordemCompra.findUnique({
        where: { idOc: Number(idOc) },
        include: { itens: true }
      });

      if (!oc || oc.status === "CANCELADA" || oc.status === "ATENDIDA") {
        throw new ErroDeNegocio(
          "Ordem de Compra inválida, cancelada ou já integralmente atendida."
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      // 1. Criar registro do Lote
      const lote = await tx.lote.create({
        data: {
          numLote: String(numLote).trim(),
          idProd: produto.idProd,
          idFornec: idFornec ? Number(idFornec) : (oc ? oc.idFornec : null),
          idOc: idOc ? Number(idOc) : null,
          numeroNf: numeroNf ? String(numeroNf).trim() : null,
          dataCompra: dCompra,
          valorCompra: Number(Number(valorCompra || 0).toFixed(2)),
          dataFabricacao: dFabricacao,
          dataValidade: dValidade,
          quantidadeRecebida: qtdRecebidaNum,
          quantidadeAtual: qtdRecebidaNum,
          status: "DISPONIVEL"
        }
      });

      // 2. Vincular aos Locais Físicos (lote_local) e gravar auditoria em movimentacoes_estoque (RN12)
      for (const aloc of listaAlocacoes) {
        await tx.loteLocal.create({
          data: {
            idLote: lote.idLote,
            idLocal: Number(aloc.idLocal),
            quantidade: Number(aloc.quantidade)
          }
        });

        await tx.movimentacaoEstoque.create({
          data: {
            idLote: lote.idLote,
            idLocal: Number(aloc.idLocal),
            tipo: "ENTRADA",
            quantidade: Number(aloc.quantidade),
            justificativa: "RECEBIMENTO",
            observacao: numeroNf ? `Recebimento NF ${numeroNf}` : `Recebimento Lote ${lote.numLote}`,
            idUsuario: Number(idUsuario)
          }
        });
      }

      // 3. Incrementar saldo consolidado do produto
      await tx.produto.update({
        where: { idProd: produto.idProd },
        data: {
          estoqueAtual: { increment: qtdRecebidaNum }
        }
      });

      // 4. Se vinculado a Ordem de Compra, atualizar itens_oc e status da OC (RN11)
      if (oc) {
        const itemOc = oc.itens.find((it) => it.idProd === produto.idProd);
        if (itemOc) {
          await tx.itemOC.update({
            where: {
              idOc_idProd: {
                idOc: oc.idOc,
                idProd: produto.idProd
              }
            },
            data: {
              quantidadeRecebida: { increment: qtdRecebidaNum }
            }
          });
        }

        // Checar todos os itens da OC para definir se está ATENDIDA ou PARCIALMENTE_ATENDIDA
        const todosItensAtualizados = await tx.itemOC.findMany({
          where: { idOc: oc.idOc }
        });

        const todosAtendidos = todosItensAtualizados.every(
          (it) => it.quantidadeRecebida >= it.quantidadePedida
        );

        await tx.ordemCompra.update({
          where: { idOc: oc.idOc },
          data: {
            status: todosAtendidos ? "ATENDIDA" : "PARCIALMENTE_ATENDIDA"
          }
        });
      }

      return tx.lote.findUnique({
        where: { idLote: lote.idLote },
        include: {
          produto: true,
          fornecedor: true,
          locais: { include: { local: true } }
        }
      });
    });
  }

  async atualizar(idLote, dados) {
    const lote = await this.buscarPorId(idLote);

    const dCompra = dados.dataCompra ? new Date(dados.dataCompra) : lote.dataCompra;
    const dValidade = dados.dataValidade !== undefined ? (dados.dataValidade ? new Date(dados.dataValidade) : null) : lote.dataValidade;

    if (dValidade && dValidade < dCompra) {
      throw new ErroDeNegocio("A data de validade não pode ser anterior à data de compra.");
    }

    return prisma.lote.update({
      where: { idLote: Number(idLote) },
      data: {
        numLote: dados.numLote || undefined,
        dataCompra: dados.dataCompra ? new Date(dados.dataCompra) : undefined,
        valorCompra: dados.valorCompra !== undefined ? Number(Number(dados.valorCompra).toFixed(2)) : undefined,
        dataFabricacao: dados.dataFabricacao !== undefined ? (dados.dataFabricacao ? new Date(dados.dataFabricacao) : null) : undefined,
        dataValidade: dValidade,
        status: dados.status || undefined
      }
    });
  }
}

module.exports = new LoteService();
