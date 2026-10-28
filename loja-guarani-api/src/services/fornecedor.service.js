const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");
const { validarCNPJ, formatarCNPJ, limparDigitos } = require("../lib/validators");

class FornecedorService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.busca) {
      const termo = filtros.busca.trim();
      where.OR = [
        { razSocial: { contains: termo } },
        { nomeFantasia: { contains: termo } },
        { cnpj: { contains: termo } }
      ];
    }

    return prisma.fornecedor.findMany({
      where,
      include: {
        produtosFornecidos: {
          include: { produto: true }
        }
      },
      orderBy: { razSocial: "asc" }
    });
  }

  async buscarPorId(idFornec) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { idFornec: Number(idFornec) },
      include: {
        produtosFornecidos: {
          include: { produto: true }
        },
        lotes: {
          take: 10,
          orderBy: { dataCompra: "desc" }
        },
        ordensCompra: {
          take: 10,
          orderBy: { dataEmissao: "desc" }
        }
      }
    });

    if (!fornecedor) {
      throw new ErroNaoEncontrado("Fornecedor não encontrado.");
    }

    return fornecedor;
  }

  async criar(dados) {
    const {
      cnpj,
      razSocial,
      nomeFantasia,
      contatoPrincipal,
      telefone,
      email,
      endereco,
      condicoesPagtoPadrao,
      prazoMedioDias
    } = dados;

    if (!cnpj || !razSocial) {
      throw new ErroDeNegocio("CNPJ e Razão Social são obrigatórios.");
    }

    // Regra RN08: Validar dígitos verificadores do CNPJ (14 dígitos)
    if (!validarCNPJ(cnpj)) {
      throw new ErroDeNegocio("CNPJ informado é inválido. Verifique os dígitos verificadores.");
    }

    const cnpjFormatado = formatarCNPJ(cnpj);
    const cnpjNumerico = limparDigitos(cnpj);

    const existente = await prisma.fornecedor.findFirst({
      where: {
        OR: [{ cnpj: cnpjFormatado }, { cnpj: cnpjNumerico }]
      }
    });

    if (existente) {
      throw new ErroDeNegocio("CNPJ já cadastrado para outro fornecedor.");
    }

    return prisma.fornecedor.create({
      data: {
        cnpj: cnpjFormatado,
        razSocial,
        nomeFantasia: nomeFantasia || null,
        contatoPrincipal: contatoPrincipal || null,
        telefone: telefone || null,
        email: email || null,
        endereco: endereco || null,
        condicoesPagtoPadrao: condicoesPagtoPadrao || "28/56 dias boleto",
        prazoMedioDias: prazoMedioDias ? Number(prazoMedioDias) : 5,
        status: "ATIVO"
      }
    });
  }

  async atualizar(idFornec, dados) {
    await this.buscarPorId(idFornec);

    if (dados.cnpj) {
      if (!validarCNPJ(dados.cnpj)) {
        throw new ErroDeNegocio("CNPJ informado é inválido.");
      }
      const cnpjFormatado = formatarCNPJ(dados.cnpj);
      const cnpjNumerico = limparDigitos(dados.cnpj);

      const existente = await prisma.fornecedor.findFirst({
        where: {
          OR: [{ cnpj: cnpjFormatado }, { cnpj: cnpjNumerico }],
          idFornec: { not: Number(idFornec) }
        }
      });
      if (existente) {
        throw new ErroDeNegocio("CNPJ já cadastrado para outro fornecedor.");
      }
      dados.cnpj = cnpjFormatado;
    }

    return prisma.fornecedor.update({
      where: { idFornec: Number(idFornec) },
      data: {
        cnpj: dados.cnpj || undefined,
        razSocial: dados.razSocial || undefined,
        nomeFantasia: dados.nomeFantasia !== undefined ? dados.nomeFantasia : undefined,
        contatoPrincipal: dados.contatoPrincipal !== undefined ? dados.contatoPrincipal : undefined,
        telefone: dados.telefone !== undefined ? dados.telefone : undefined,
        email: dados.email !== undefined ? dados.email : undefined,
        endereco: dados.endereco !== undefined ? dados.endereco : undefined,
        condicoesPagtoPadrao:
          dados.condicoesPagtoPadrao !== undefined ? dados.condicoesPagtoPadrao : undefined,
        prazoMedioDias: dados.prazoMedioDias !== undefined ? Number(dados.prazoMedioDias) : undefined,
        status: dados.status || undefined
      }
    });
  }

  async vincularProduto(idFornec, { idProd, precoCustoAcordado, leadTimeDias }) {
    await this.buscarPorId(idFornec);

    const produto = await prisma.produto.findUnique({
      where: { idProd: Number(idProd) }
    });
    if (!produto) {
      throw new ErroDeNegocio("Produto não encontrado.");
    }

    return prisma.produtoFornecedor.upsert({
      where: {
        idProd_idFornec: {
          idProd: Number(idProd),
          idFornec: Number(idFornec)
        }
      },
      create: {
        idProd: Number(idProd),
        idFornec: Number(idFornec),
        precoCustoAcordado: precoCustoAcordado ? Number(Number(precoCustoAcordado).toFixed(2)) : null,
        leadTimeDias: leadTimeDias ? Number(leadTimeDias) : 7
      },
      update: {
        precoCustoAcordado: precoCustoAcordado ? Number(Number(precoCustoAcordado).toFixed(2)) : undefined,
        leadTimeDias: leadTimeDias ? Number(leadTimeDias) : undefined
      }
    });
  }

  async removerVinculoProduto(idFornec, idProd) {
    return prisma.produtoFornecedor.deleteMany({
      where: {
        idFornec: Number(idFornec),
        idProd: Number(idProd)
      }
    });
  }
}

module.exports = new FornecedorService();
