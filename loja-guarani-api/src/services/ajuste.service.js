const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class AjusteService {
  async listarHistorico(filtros = {}) {
    // Buscar todas as movimentações ordenadas cronologicamente para reconstruir os saldos
    const todosMovs = await prisma.movimentacaoEstoque.findMany({
      include: {
        lote: {
          include: { produto: true }
        },
        local: true,
        usuario: {
          select: { idUsuario: true, nome: true, emailLogin: true, perfil: true }
        }
      },
      orderBy: { idMov: "asc" }
    });

    // Calcular saldos acumulados por chave única (idLote + idLocal)
    const saldosPorChave = {};
    const movsComSaldos = todosMovs.map((m) => {
      const chave = `${m.idLote}_${m.idLocal || 0}`;
      const saldoAnt = saldosPorChave[chave] || 0;
      let saldoPost = saldoAnt;

      if (m.tipo === "ENTRADA" || m.tipo === "CANCELAMENTO_RESERVA") {
        saldoPost = saldoAnt + m.quantidade;
      } else {
        saldoPost = Math.max(0, saldoAnt - m.quantidade);
      }

      saldosPorChave[chave] = saldoPost;

      return {
        ...m,
        saldoAnterior: saldoAnt,
        saldoPosterior: saldoPost
      };
    });

    // Aplicar filtros após cômputo dos saldos contábeis
    let resultado = movsComSaldos;
    if (filtros.tipo) {
      resultado = resultado.filter((m) => m.tipo === filtros.tipo);
    }
    if (filtros.justificativa) {
      resultado = resultado.filter((m) => m.justificativa === filtros.justificativa);
    }
    if (filtros.idProd) {
      resultado = resultado.filter((m) => m.lote?.idProd === Number(filtros.idProd));
    }

    // Ordenar decrescente (mais recente primeiro)
    return resultado.reverse();
  }

  async registrarAjuste(dados, idUsuario) {
    const { idProd, idLote, idLocal, tipo, quantidade, justificativa, observacao } = dados;

    if (!idProd || !idLote || !idLocal || !tipo || !quantidade || !justificativa) {
      throw new ErroDeNegocio(
        "Produto, lote, local, tipo, quantidade e justificativa são obrigatórios."
      );
    }

    const qtdNum = Number(quantidade);
    if (!Number.isInteger(qtdNum) || qtdNum <= 0) {
      throw new ErroDeNegocio("A quantidade do ajuste deve ser um número inteiro maior que zero.");
    }

    const tiposValidos = ["ENTRADA", "BAIXA"];
    if (!tiposValidos.includes(tipo)) {
      throw new ErroDeNegocio("Tipo de ajuste deve ser ENTRADA ou BAIXA.");
    }

    // Regra RN19: Justificativas permitidas para ajuste manual
    const justificativasValidas = ["QUEBRA", "VENCIMENTO", "ROUBO", "INVENTARIO"];
    if (!justificativasValidas.includes(justificativa)) {
      throw new ErroDeNegocio(
        `Justificativa inválida. Opções permitidas: ${justificativasValidas.join(", ")}.`
      );
    }

    // Regra de Auditoria: Observação detalhada obrigatória com no mínimo 15 caracteres
    if (!observacao || observacao.trim().length < 15) {
      throw new ErroDeNegocio(
        "A observação detalhada de auditoria deve conter no mínimo 15 caracteres."
      );
    }

    return prisma.$transaction(async (tx) => {
      const lote = await tx.lote.findUnique({
        where: { idLote: Number(idLote) },
        include: { produto: true }
      });

      if (!lote || lote.idProd !== Number(idProd)) {
        throw new ErroNaoEncontrado("Lote informado não existe ou não pertence a este produto.");
      }

      const loteLocal = await tx.loteLocal.findUnique({
        where: {
          idLote_idLocal: {
            idLote: Number(idLote),
            idLocal: Number(idLocal)
          }
        },
        include: { local: true }
      });

      if (!loteLocal) {
        throw new ErroDeNegocio("O lote selecionado não está vinculado ao local físico informado.");
      }

      let novoSaldoLote = lote.quantidadeAtual;
      let novoSaldoLocal = loteLocal.quantidade;
      let novoEstoqueProduto = lote.produto.estoqueAtual;

      if (tipo === "BAIXA") {
        // Regra RN19 / UC12-E1: Baixas manuais não podem exceder o saldo atual do lote ou do local
        if (qtdNum > loteLocal.quantidade || qtdNum > lote.quantidadeAtual) {
          throw new ErroDeNegocio(
            `Baixa não permitida. A quantidade excede o saldo atual disponível (${loteLocal.quantidade} un).`
          );
        }

        novoSaldoLote -= qtdNum;
        novoSaldoLocal -= qtdNum;
        novoEstoqueProduto -= qtdNum;
      } else {
        // ENTRADA: Validar capacidade do local físico
        const ocupacaoOutros = await tx.loteLocal.aggregate({
          where: {
            idLocal: Number(idLocal),
            idLote: { not: Number(idLote) }
          },
          _sum: { quantidade: true }
        });

        const ocupacaoTotalNova = (ocupacaoOutros._sum.quantidade || 0) + novoSaldoLocal + qtdNum;
        if (ocupacaoTotalNova > loteLocal.local.capacidade) {
          const livre = Math.max(0, loteLocal.local.capacidade - (ocupacaoOutros._sum.quantidade || 0) - novoSaldoLocal);
          throw new ErroDeNegocio(
            `Capacidade máxima do local ${loteLocal.local.codigo} excedida (Livre: ${livre} un; Solicitado: ${qtdNum} un).`
          );
        }

        novoSaldoLote += qtdNum;
        novoSaldoLocal += qtdNum;
        novoEstoqueProduto += qtdNum;
      }

      // Determinar novo status do lote
      let novoStatusLote = lote.status;
      if (novoSaldoLote === 0) {
        novoStatusLote = justificativa === "VENCIMENTO" || justificativa === "QUEBRA" || justificativa === "ROUBO"
          ? "BAIXADO_DESCARTE"
          : "ESGOTADO";
      } else if (lote.status === "ESGOTADO" || lote.status === "BAIXADO_DESCARTE") {
        novoStatusLote = "DISPONIVEL";
      }

      // Atualizar lote
      await tx.lote.update({
        where: { idLote: lote.idLote },
        data: {
          quantidadeAtual: novoSaldoLote,
          status: novoStatusLote
        }
      });

      // Atualizar lote_local
      await tx.loteLocal.update({
        where: {
          idLote_idLocal: {
            idLote: lote.idLote,
            idLocal: Number(idLocal)
          }
        },
        data: { quantidade: novoSaldoLocal }
      });

      // Atualizar produto
      await tx.produto.update({
        where: { idProd: lote.idProd },
        data: { estoqueAtual: novoEstoqueProduto }
      });

      // Gravar trilha de auditoria imutável (RN20)
      const mov = await tx.movimentacaoEstoque.create({
        data: {
          idLote: lote.idLote,
          idLocal: Number(idLocal),
          tipo,
          quantidade: qtdNum,
          justificativa,
          observacao: observacao.trim(),
          idUsuario: Number(idUsuario)
        }
      });

      // Gatilho UC14: Verificar alerta de estoque mínimo
      const alertaEstoqueMinimo =
        novoEstoqueProduto <= lote.produto.estoqueMin && lote.produto.estoqueMin > 0;

      return {
        idMov: mov.idMov,
        tipo,
        quantidade: qtdNum,
        justificativa,
        observacao: mov.observacao,
        saldoAnteriorLocal: loteLocal.quantidade,
        novoSaldoLocal,
        saldoAnteriorLote: lote.quantidadeAtual,
        novoSaldoLote,
        saldoAnteriorProduto: lote.produto.estoqueAtual,
        novoEstoqueProduto,
        alertaEstoqueMinimo,
        dataHora: mov.dataHora
      };
    });
  }
}

module.exports = new AjusteService();
