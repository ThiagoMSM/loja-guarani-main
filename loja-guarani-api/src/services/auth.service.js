const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { ErroDeNegocio, ErroNaoAutorizado, ErroProibido, ErroNaoEncontrado } = require("../lib/errors");
const { getConfig, isBusinessHoursNow } = require("../config/runtime-config");

class AuthService {
  async login({ emailLogin, senha }) {
    if (!emailLogin || !senha) {
      throw new ErroDeNegocio("E-mail e senha são obrigatórios.");
    }

    const emailLimpo = emailLogin.trim().toLowerCase();
    const usuario = await prisma.usuario.findFirst({
      where: {
        emailLogin: {
          equals: emailLimpo
        }
      },
      include: { vendedor: true }
    });

    if (!usuario) {
      throw new ErroNaoAutorizado("Usuário ou senha inválidos. Verifique os dados digitados.");
    }

    if (usuario.status === "INATIVO") {
      throw new ErroProibido("Acesso bloqueado: conta inativa. Contate o Proprietário.");
    }

    // Verificar bloqueio por tentativas excessivas (RN01)
    if (usuario.status === "BLOQUEADO") {
      if (usuario.bloqueadoAte && new Date() >= new Date(usuario.bloqueadoAte)) {
        // Desbloqueio automático após 15 minutos
        await prisma.usuario.update({
          where: { idUsuario: usuario.idUsuario },
          data: {
            status: "ATIVO",
            tentativasFalhas: 0,
            bloqueadoAte: null
          }
        });
        usuario.status = "ATIVO";
        usuario.tentativasFalhas = 0;
      } else {
        throw new ErroProibido(
          "Acesso bloqueado por segurança por 15 minutos devido a tentativas excessivas. Contate o Proprietário."
        );
      }
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      const novasTentativas = usuario.tentativasFalhas + 1;
      if (novasTentativas >= 5) {
        await prisma.usuario.update({
          where: { idUsuario: usuario.idUsuario },
          data: {
            status: "BLOQUEADO",
            tentativasFalhas: novasTentativas,
            bloqueadoAte: new Date(Date.now() + 15 * 60 * 1000)
          }
        });
        throw new ErroProibido(
          "Acesso bloqueado por segurança por 15 minutos devido a tentativas excessivas. Contate o Proprietário."
        );
      } else {
        await prisma.usuario.update({
          where: { idUsuario: usuario.idUsuario },
          data: { tentativasFalhas: novasTentativas }
        });
        throw new ErroNaoAutorizado("Usuário ou senha inválidos. Verifique os dados digitados.");
      }
    }

    // Regra RNF10: Validação de horário comercial para perfil VENDEDOR
    const config = getConfig();
    if (config.enforceBusinessHours && usuario.perfil === "VENDEDOR") {
      if (!isBusinessHoursNow()) {
        throw new ErroProibido(
          "Acesso restrito ao horário comercial da Loja Guarani (Segunda a Sexta, das 10h00 às 18h00)."
        );
      }
    }

    // Zerar contador de falhas e atualizar último acesso
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: {
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoAcesso: new Date()
      }
    });

    const secret = process.env.JWT_SECRET || "chave_secreta_loja_guarani_bom_retiro_2026";
    const expiresIn = process.env.JWT_EXPIRES_IN || "8h";

    const payload = {
      idUsuario: usuario.idUsuario,
      nome: usuario.nome,
      emailLogin: usuario.emailLogin,
      perfil: usuario.perfil,
      idVend: usuario.vendedor ? usuario.vendedor.idVend : null
    };

    const token = jwt.sign(payload, secret, { expiresIn });

    return {
      token,
      usuario: {
        idUsuario: usuario.idUsuario,
        nome: usuario.nome,
        emailLogin: usuario.emailLogin,
        perfil: usuario.perfil,
        ultimoAcesso: usuario.ultimoAcesso,
        idVend: usuario.vendedor ? usuario.vendedor.idVend : null
      }
    };
  }

  async listarUsuarios() {
    return prisma.usuario.findMany({
      include: { vendedor: true },
      orderBy: { idUsuario: "asc" }
    });
  }

  async criarUsuario({ nome, emailLogin, senha, perfil, cpf, cargo, telefone }) {
    if (!nome || !emailLogin || !senha || !perfil) {
      throw new ErroDeNegocio("Nome, e-mail, senha e perfil são obrigatórios.");
    }

    const emailLimpo = emailLogin.trim().toLowerCase();
    const existente = await prisma.usuario.findUnique({
      where: { emailLogin: emailLimpo }
    });

    if (existente) {
      throw new ErroDeNegocio("E-mail de login já cadastrado para outro usuário.");
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    return prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome,
          emailLogin: emailLimpo,
          senhaHash,
          perfil,
          status: "ATIVO"
        }
      });

      if (perfil === "VENDEDOR") {
        if (!cpf) {
          throw new ErroDeNegocio("CPF é obrigatório para cadastrar perfil Vendedor.");
        }
        await tx.vendedor.create({
          data: {
            idUsuario: usuario.idUsuario,
            cpf,
            cargo: cargo || "Vendedor Balconista",
            telefone: telefone || null,
            email: emailLimpo
          }
        });
      }

      return tx.usuario.findUnique({
        where: { idUsuario: usuario.idUsuario },
        include: { vendedor: true }
      });
    });
  }

  async resetSenha({ idUsuario, novaSenha }) {
    if (!novaSenha || novaSenha.length < 6) {
      throw new ErroDeNegocio("A nova senha deve ter no mínimo 6 caracteres.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: Number(idUsuario) }
    });

    if (!usuario) {
      throw new ErroNaoEncontrado("Usuário não encontrado.");
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    return prisma.usuario.update({
      where: { idUsuario: Number(idUsuario) },
      data: {
        senhaHash,
        status: "ATIVO",
        tentativasFalhas: 0,
        bloqueadoAte: null
      }
    });
  }

  async alterarStatusUsuario({ idUsuario, status }) {
    const permitidos = ["ATIVO", "INATIVO", "BLOQUEADO"];
    if (!permitidos.includes(status)) {
      throw new ErroDeNegocio(`Status inválido. Permitidos: ${permitidos.join(", ")}`);
    }

    return prisma.usuario.update({
      where: { idUsuario: Number(idUsuario) },
      data: {
        status,
        tentativasFalhas: status === "ATIVO" ? 0 : undefined,
        bloqueadoAte: status === "ATIVO" ? null : undefined
      }
    });
  }
}

module.exports = new AuthService();
