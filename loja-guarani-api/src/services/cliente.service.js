const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoEncontrado } = require("../lib/errors");
const { mascararDocumentoLgpd, limparDigitos } = require("../lib/validators");

class ClienteService {
  async listar(filtros = {}, perfilUsuario = "PROPRIETARIO") {
    const where = {};
    if (filtros.status) {
      where.status = filtros.status;
    }
    if (filtros.busca) {
      const termo = filtros.busca.trim();
      where.OR = [
        { nome: { contains: termo } },
        { cpfCnpj: { contains: termo } },
        { telefone: { contains: termo } }
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: "asc" }
    });

    // LGPD RNF05: Ocultação parcial (mascaramento) de CPF em listagens visuais para o perfil Vendedor
    if (perfilUsuario === "VENDEDOR") {
      return clientes.map((c) => ({
        ...c,
        cpfCnpj: mascararDocumentoLgpd(c.cpfCnpj)
      }));
    }

    return clientes;
  }

  async buscarPorId(idCliente, perfilUsuario = "PROPRIETARIO") {
    const cliente = await prisma.cliente.findUnique({
      where: { idCliente: Number(idCliente) },
      include: {
        pedidosVenda: { take: 5, orderBy: { dataPedido: "desc" } },
        vendas: { take: 5, orderBy: { dataVenda: "desc" } }
      }
    });

    if (!cliente) {
      throw new ErroNaoEncontrado("Cliente não encontrado.");
    }

    if (perfilUsuario === "VENDEDOR") {
      return {
        ...cliente,
        cpfCnpj: mascararDocumentoLgpd(cliente.cpfCnpj)
      };
    }

    return cliente;
  }

  async criar({ nome, cpfCnpj, telefone, endereco, email }) {
    if (!nome) {
      throw new ErroDeNegocio("Nome do cliente é obrigatório.");
    }

    let docLimpo = cpfCnpj ? limparDigitos(cpfCnpj) : null;
    if (docLimpo) {
      const existente = await prisma.cliente.findFirst({
        where: { cpfCnpj: docLimpo }
      });
      if (existente) {
        throw new ErroDeNegocio("CPF/CNPJ já cadastrado para outro cliente.");
      }
    }

    return prisma.cliente.create({
      data: {
        nome,
        cpfCnpj: docLimpo,
        telefone: telefone || null,
        endereco: endereco || null,
        email: email || null,
        status: "ATIVO"
      }
    });
  }

  async atualizar(idCliente, dados) {
    await this.buscarPorId(idCliente);

    let docLimpo = dados.cpfCnpj !== undefined ? (dados.cpfCnpj ? limparDigitos(dados.cpfCnpj) : null) : undefined;
    if (docLimpo) {
      const existente = await prisma.cliente.findFirst({
        where: {
          cpfCnpj: docLimpo,
          idCliente: { not: Number(idCliente) }
        }
      });
      if (existente) {
        throw new ErroDeNegocio("CPF/CNPJ já cadastrado para outro cliente.");
      }
    }

    return prisma.cliente.update({
      where: { idCliente: Number(idCliente) },
      data: {
        nome: dados.nome || undefined,
        cpfCnpj: docLimpo,
        telefone: dados.telefone !== undefined ? dados.telefone : undefined,
        endereco: dados.endereco !== undefined ? dados.endereco : undefined,
        email: dados.email !== undefined ? dados.email : undefined,
        status: dados.status || undefined
      }
    });
  }

  // LGPD Art. 18 (RNF05): Anonimização ou exclusão de dados cadastrais a pedido do titular
  async anonimizar(idCliente) {
    const cliente = await this.buscarPorId(idCliente);

    return prisma.cliente.update({
      where: { idCliente: Number(idCliente) },
      data: {
        nome: `TITULAR ANONIMIZADO #${cliente.idCliente}`,
        cpfCnpj: null,
        telefone: null,
        endereco: null,
        email: null,
        status: "ANONIMIZADO"
      }
    });
  }
}

module.exports = new ClienteService();
