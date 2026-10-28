const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");

class CategoriaService {
  async listar() {
    return prisma.categoria.findMany({
      include: {
        categoriaPai: true,
        subcategorias: true,
        _count: {
          select: { produtos: true, subcategorias: true }
        }
      },
      orderBy: [{ codigoHierarquico: "asc" }, { nome: "asc" }]
    });
  }

  async buscarPorId(idCateg) {
    const categoria = await prisma.categoria.findUnique({
      where: { idCateg: Number(idCateg) },
      include: {
        categoriaPai: true,
        subcategorias: true,
        produtos: true
      }
    });

    if (!categoria) {
      throw new ErroNaoEncontrado("Categoria não encontrada.");
    }

    return categoria;
  }

  async criar({ codigoHierarquico, nome, descricao, idCategPai }) {
    if (!nome) {
      throw new ErroDeNegocio("Nome da categoria é obrigatório.");
    }

    if (codigoHierarquico) {
      const existente = await prisma.categoria.findUnique({
        where: { codigoHierarquico }
      });
      if (existente) {
        throw new ErroDeNegocio("Código hierárquico já cadastrado.");
      }
    }

    if (idCategPai) {
      const pai = await prisma.categoria.findUnique({
        where: { idCateg: Number(idCategPai) }
      });
      if (!pai) {
        throw new ErroDeNegocio("Categoria pai informada não existe.");
      }
    }

    return prisma.categoria.create({
      data: {
        codigoHierarquico: codigoHierarquico || null,
        nome,
        descricao: descricao || null,
        idCategPai: idCategPai ? Number(idCategPai) : null,
        status: "ATIVO"
      }
    });
  }

  async atualizar(idCateg, { codigoHierarquico, nome, descricao, idCategPai, status }) {
    await this.buscarPorId(idCateg);

    if (codigoHierarquico) {
      const existente = await prisma.categoria.findFirst({
        where: {
          codigoHierarquico,
          idCateg: { not: Number(idCateg) }
        }
      });
      if (existente) {
        throw new ErroDeNegocio("Código hierárquico já está em uso por outra categoria.");
      }
    }

    return prisma.categoria.update({
      where: { idCateg: Number(idCateg) },
      data: {
        codigoHierarquico: codigoHierarquico !== undefined ? codigoHierarquico : undefined,
        nome: nome || undefined,
        descricao: descricao !== undefined ? descricao : undefined,
        idCategPai: idCategPai !== undefined ? (idCategPai ? Number(idCategPai) : null) : undefined,
        status: status || undefined
      }
    });
  }

  async excluir(idCateg) {
    const categoria = await prisma.categoria.findUnique({
      where: { idCateg: Number(idCateg) },
      include: {
        _count: {
          select: { produtos: true, subcategorias: true }
        }
      }
    });

    if (!categoria) {
      throw new ErroNaoEncontrado("Categoria não encontrada.");
    }

    // Regra RN03: Impedir exclusão de categoria com produtos ou subcategorias vinculados
    if (categoria._count.produtos > 0 || categoria._count.subcategorias > 0) {
      throw new ErroDeNegocio(
        "Categoria possui subcategorias ou produtos vinculados e não pode ser excluída."
      );
    }

    return prisma.categoria.delete({
      where: { idCateg: Number(idCateg) }
    });
  }
}

module.exports = new CategoriaService();
