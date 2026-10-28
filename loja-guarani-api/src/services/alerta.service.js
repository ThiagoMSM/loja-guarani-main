const prisma = require("../lib/prisma");

class AlertaService {
  async listarAlertas() {
    // Buscar produtos ativos que estão abaixo ou no estoque mínimo
    const produtos = await prisma.produto.findMany({
      where: {
        status: "ATIVO",
        estoqueMin: { gt: 0 }
      },
      include: {
        categoria: true,
        fornecedores: {
          include: { fornecedor: true },
          orderBy: [{ precoCustoAcordado: "asc" }, { leadTimeDias: "asc" }]
        },
        lotes: {
          where: { status: "DISPONIVEL", quantidadeAtual: { gt: 0 } },
          include: { locais: { include: { local: true } } }
        },
        itensOc: {
          where: {
            ordemCompra: {
              status: { in: ["AGUARDANDO_RECEBIMENTO", "PARCIALMENTE_ATENDIDA"] }
            }
          },
          include: { ordemCompra: true }
        }
      },
      orderBy: [{ estoqueAtual: "asc" }, { nome: "asc" }]
    });

    const alertas = [];

    for (const prod of produtos) {
      if (prod.estoqueAtual <= prod.estoqueMin) {
        const criticidade = prod.estoqueAtual === 0 ? "CRITICO" : "ALERTA";

        // Verificar se já existe Ordem de Compra aberta (UC14-A1)
        const ocAberta = prod.itensOc.find((it) =>
          ["AGUARDANDO_RECEBIMENTO", "PARCIALMENTE_ATENDIDA"].includes(it.ordemCompra.status)
        );

        const statusAlerta = ocAberta ? "EM_REPOSICAO" : "PENDENTE";
        const idOcAberta = ocAberta ? ocAberta.idOc : null;

        // Fornecedor preferencial (menor custo ou menor lead time)
        const fornecedorPref = prod.fornecedores.length > 0 ? prod.fornecedores[0] : null;

        // Coletar gaveteiros físicos onde o produto costuma ficar
        const locaisNomes = new Set();
        prod.lotes.forEach((l) => {
          l.locais.forEach((ll) => {
            if (ll.local && ll.local.codigo) locaisNomes.add(ll.local.codigo);
          });
        });

        const qtdSugerida = Math.max(
          prod.estoqueMin * 2 - prod.estoqueAtual,
          prod.qtdMinimaVenda,
          10
        );

        alertas.push({
          idProd: prod.idProd,
          sku: prod.sku,
          nome: prod.nome,
          categoriaNome: prod.categoria?.nome || "-",
          unidMedida: prod.unidMedida,
          estoqueAtual: prod.estoqueAtual,
          estoqueReservado: prod.estoqueReservado,
          estoqueMin: prod.estoqueMin,
          criticidade,
          statusAlerta,
          idOcAberta,
          quantidadeSugerida: qtdSugerida,
          locaisFisicos: Array.from(locaisNomes).join(", ") || "Sem gaveta definida",
          fornecedorPreferencial: fornecedorPref
            ? {
                idFornec: fornecedorPref.idFornec,
                nome: fornecedorPref.fornecedor.razSocial,
                nomeFantasia: fornecedorPref.fornecedor.nomeFantasia,
                precoCusto: fornecedorPref.precoCustoAcordado,
                leadTimeDias: fornecedorPref.leadTimeDias
              }
            : null
        });
      }
    }

    return alertas;
  }
}

module.exports = new AlertaService();
