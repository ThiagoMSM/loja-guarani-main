const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class LocalService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }

    const locais = await prisma.local.findMany({
      where,
      include: {
        lotesAlocados: {
          include: {
            lote: {
              include: { produto: true }
            }
          }
        }
      },
      orderBy: { codigo: "asc" }
    });

    return locais.map((loc) => {
      const ocupacaoAtual = loc.lotesAlocados.reduce((acc, ll) => acc + ll.quantidade, 0);
      const capacidadeLivre = Math.max(0, loc.capacidade - ocupacaoAtual);
      const percentualOcupacao = Math.min(
        100,
        Math.round((ocupacaoAtual / loc.capacidade) * 100)
      );

      return {
        ...loc,
        ocupacaoAtual,
        capacidadeLivre,
        percentualOcupacao
      };
    });
  }

  async buscarPorId(idLocal) {
    const local = await prisma.local.findUnique({
      where: { idLocal: Number(idLocal) },
      include: {
        lotesAlocados: {
          include: {
            lote: {
              include: { produto: true }
            }
          }
        }
      }
    });

    if (!local) {
      throw new ErroNaoEncontrado("Local de armazenamento não encontrado.");
    }

    const ocupacaoAtual = local.lotesAlocados.reduce((acc, ll) => acc + ll.quantidade, 0);
    const capacidadeLivre = Math.max(0, local.capacidade - ocupacaoAtual);
    const percentualOcupacao = Math.min(
      100,
      Math.round((ocupacaoAtual / local.capacidade) * 100)
    );

    return {
      ...local,
      ocupacaoAtual,
      capacidadeLivre,
      percentualOcupacao
    };
  }

  async criar({ codigo, tipoCompartimento, capacidade, descricao }) {
    if (!codigo || !capacidade) {
      throw new ErroDeNegocio("Código e capacidade são obrigatórios.");
    }

    const capNum = Number(capacidade);
    if (capNum <= 0) {
      throw new ErroDeNegocio("Capacidade deve ser maior que zero.");
    }

    const codLimpo = String(codigo).trim().toUpperCase();
    const existente = await prisma.local.findUnique({
      where: { codigo: codLimpo }
    });
    if (existente) {
      throw new ErroDeNegocio("Código de local físico já cadastrado.");
    }

    return prisma.local.create({
      data: {
        codigo: codLimpo,
        tipoCompartimento: tipoCompartimento || "GAVETEIRO",
        capacidade: capNum,
        descricao: descricao || null,
        status: "ATIVO"
      }
    });
  }

  async atualizar(idLocal, { codigo, tipoCompartimento, capacidade, descricao, status }) {
    const local = await this.buscarPorId(idLocal);

    if (codigo) {
      const codLimpo = String(codigo).trim().toUpperCase();
      const existente = await prisma.local.findFirst({
        where: {
          codigo: codLimpo,
          idLocal: { not: Number(idLocal) }
        }
      });
      if (existente) {
        throw new ErroDeNegocio("Código de local físico já cadastrado.");
      }
    }

    if (capacidade !== undefined) {
      const novaCap = Number(capacidade);
      if (novaCap < local.ocupacaoAtual) {
        throw new ErroDeNegocio(
          `Nova capacidade (${novaCap}) não pode ser inferior à ocupação atual (${local.ocupacaoAtual}).`
        );
      }
    }

    return prisma.local.update({
      where: { idLocal: Number(idLocal) },
      data: {
        codigo: codigo ? String(codigo).trim().toUpperCase() : undefined,
        tipoCompartimento: tipoCompartimento || undefined,
        capacidade: capacidade !== undefined ? Number(capacidade) : undefined,
        descricao: descricao !== undefined ? descricao : undefined,
        status: status || undefined
      }
    });
  }

  async inativar(idLocal) {
    const local = await this.buscarPorId(idLocal);

    // Regra RN06: Um local físico só pode ser inativado ou excluído se a soma das quantidades alocadas for igual a zero
    if (local.ocupacaoAtual > 0) {
      throw new ErroDeNegocio(
        `Não é possível inativar este local pois existem ${local.ocupacaoAtual} unidades de lotes vinculadas. Remaneje os itens antes de inativar.`
      );
    }

    return prisma.local.update({
      where: { idLocal: Number(idLocal) },
      data: { status: "INATIVO" }
    });
  }

  async excluir(idLocal) {
    const local = await this.buscarPorId(idLocal);

    // Regra RN06
    if (local.ocupacaoAtual > 0) {
      throw new ErroDeNegocio(
        `Não é possível inativar este local pois existem ${local.ocupacaoAtual} unidades de lotes vinculadas. Remaneje os itens antes de inativar.`
      );
    }

    return prisma.local.delete({
      where: { idLocal: Number(idLocal) }
    });
  }
}

module.exports = new LocalService();
