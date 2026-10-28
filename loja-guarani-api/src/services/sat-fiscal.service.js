const { ErroDeNegocio } = require("../lib/errors");
const { getConfig } = require("../config/runtime-config");
const { limparDigitos } = require("../lib/validators");

class SatFiscalService {
  gerarChaveAcesso(cnpjEmitente, numeroCupom) {
    const data = new Date();
    const ano = String(data.getFullYear()).slice(-2);
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const uf = "35"; // São Paulo
    const modelo = "59"; // Cupom Fiscal Eletrônico SAT
    const serieSat = "000001234";
    const numeroCupomPad = String(numeroCupom).padStart(6, "0");
    const codigoAleatorio = String(Math.floor(100000 + Math.random() * 900000));
    const cnpj = limparDigitos(cnpjEmitente).padStart(14, "0");

    const chaveSemDv = `${uf}${ano}${mes}${cnpj}${modelo}${serieSat}${numeroCupomPad}${codigoAleatorio}`;
    // Dígito verificador módulo 11
    let soma = 0;
    let peso = 2;
    for (let i = chaveSemDv.length - 1; i >= 0; i--) {
      soma += Number(chaveSemDv[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;

    return `${chaveSemDv}${dv}`;
  }

  gerarXmlCfeSat({
    numeroCupomSat,
    chaveAcessoSat,
    cnpjEmitente,
    razaoSocial,
    nomeFantasia,
    ieEmitente,
    cpfCnpjDest,
    itens,
    valorTotal,
    desconto,
    formaPagamento
  }) {
    const dataEmissao = new Date();
    const dEmi = dataEmissao.toISOString().slice(0, 10).replace(/-/g, "");
    const hEmi = dataEmissao.toTimeString().slice(0, 8).replace(/:/g, "");

    const formaPagtoCod = {
      DINHEIRO: "01",
      PIX: "17",
      CARTAO_DEBITO: "04",
      CARTAO_CREDITO: "03"
    }[formaPagamento] || "17";

    let detXml = "";
    itens.forEach((it, index) => {
      const nItem = index + 1;
      const subtotalItem = Number((it.quantidade * it.precoUnitPratic).toFixed(2));
      const nomeXml = it.nome
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      detXml += `
    <det nItem="${nItem}">
      <prod>
        <cProd>${it.sku}</cProd>
        <xProd>${nomeXml}</xProd>
        <NCM>${it.ncm}</NCM>
        <CFOP>${it.cfop}</CFOP>
        <uCom>${it.unidMedida}</uCom>
        <qCom>${Number(it.quantidade).toFixed(4)}</qCom>
        <vUnCom>${Number(it.precoUnitPratic).toFixed(2)}</vUnCom>
        <indRegra>A</indRegra>
        <vItem>${subtotalItem.toFixed(2)}</vItem>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <Orig>0</Orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISSN>
            <CST>49</CST>
          </PISSN>
        </PIS>
        <COFINS>
          <COFINSSN>
            <CST>49</CST>
          </COFINSSN>
        </COFINS>
      </imposto>
    </det>`;
    });

    const destXml = cpfCnpjDest
      ? `<dest>${
          cpfCnpjDest.length === 11
            ? `<CPF>${cpfCnpjDest}</CPF>`
            : `<CNPJ>${cpfCnpjDest}</CNPJ>`
        }</dest>`
      : `<dest />`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<CFe>
  <infCFe versaoDadosEnt="0.08" Id="CFe${chaveAcessoSat}">
    <ide>
      <cUF>35</cUF>
      <cNF>${String(Math.floor(100000 + Math.random() * 900000))}</cNF>
      <mod>59</mod>
      <nserieSAT>000001234</nserieSAT>
      <nCFe>${numeroCupomSat}</nCFe>
      <dEmi>${dEmi}</dEmi>
      <hEmi>${hEmi}</hEmi>
      <cDV>${chaveAcessoSat.slice(-1)}</cDV>
      <tpAmb>2</tpAmb>
      <signAC>SGR-SAT-ASSINATURA-HOMOLOGACAO-LOJA-GUARANI</signAC>
      <numeroCaixa>01</numeroCaixa>
    </ide>
    <emit>
      <CNPJ>${limparDigitos(cnpjEmitente)}</CNPJ>
      <xNome>${razaoSocial}</xNome>
      <xFant>${nomeFantasia}</xFant>
      <enderEmit>
        <xLgr>Rua Tres Rios</xLgr>
        <nro>148</nro>
        <xBairro>Bom Retiro</xBairro>
        <xMun>Sao Paulo</xMun>
        <CEP>01123000</CEP>
      </enderEmit>
      <IE>${ieEmitente || "110042490114"}</IE>
      <cRegTrib>1</cRegTrib>
    </emit>
    ${destXml}${detXml}
    <total>
      <vCFe>${Number(valorTotal).toFixed(2)}</vCFe>
      ${desconto > 0 ? `<vDesc>${Number(desconto).toFixed(2)}</vDesc>` : ""}
    </total>
    <pgto>
      <MP>
        <cMP>${formaPagtoCod}</cMP>
        <vMP>${Number(valorTotal).toFixed(2)}</vMP>
      </MP>
    </pgto>
  </infCFe>
</CFe>`;
  }

  async emitirCupomFiscal({
    itensDetalhados,
    valorTotal,
    desconto = 0,
    formaPagamento = "PIX",
    cpfCnpjNota = null,
    simularFalhaSat = false
  }) {
    // Verificar gatilho de simulação de falha SAT (Exceção E3 / Rollback)
    const config = getConfig();
    if (simularFalhaSat || config.simularFalhaSatGlobal) {
      throw new ErroDeNegocio(
        "Falha de comunicação com o Equipamento SAT (Código 07000 — Módulo USB desconectado ou rejeição SEFAZ). Venda revertida via Rollback ACID."
      );
    }

    if (!Array.isArray(itensDetalhados) || itensDetalhados.length === 0) {
      throw new ErroDeNegocio("A emissão do Cupom Fiscal SAT exige ao menos um item de produto.");
    }

    // Regra RN18 (Portaria CAT 147/2012): Validação de discriminação individualizada de itens
    for (const it of itensDetalhados) {
      if (!it.nome || it.nome.trim() === "" || /aviamentos\s+diversos/i.test(it.nome)) {
        throw new ErroDeNegocio(
          "Violação Fiscal (Portaria CAT 147/2012): É proibido emitir CF-e-SAT com descrição genérica 'Aviamentos Diversos'. Todos os itens devem ser discriminados individualmente."
        );
      }
      if (!it.sku) {
        throw new ErroDeNegocio(`Item '${it.nome}' não possui código SKU válido para emissão fiscal.`);
      }
      if (!it.ncm || it.ncm.length !== 8) {
        throw new ErroDeNegocio(
          `Item '${it.nome}' (SKU ${it.sku}) possui NCM inválido: deve conter 8 dígitos.`
        );
      }
    }

    const cnpjEmitente = process.env.SAT_CNPJ_EMITENTE || "60716586000117";
    const razaoSocial = process.env.SAT_RAZAO_SOCIAL || "HACIB CAMASMIE E CIA LTDA";
    const nomeFantasia = process.env.SAT_NOME_FANTASIA || "LOJA GUARANI - LOJA DO TURQUINHO";
    const ieEmitente = process.env.SAT_IE_EMITENTE || "110042490114";

    const numeroCupomSat = String(Math.floor(100000 + Math.random() * 900000));
    const chaveAcessoSat = this.gerarChaveAcesso(cnpjEmitente, numeroCupomSat);

    const docClienteLimpo = cpfCnpjNota ? limparDigitos(cpfCnpjNota) : null;

    const xmlConteudo = this.gerarXmlCfeSat({
      numeroCupomSat,
      chaveAcessoSat,
      cnpjEmitente,
      razaoSocial,
      nomeFantasia,
      ieEmitente,
      cpfCnpjDest: docClienteLimpo,
      itens: itensDetalhados,
      valorTotal,
      desconto,
      formaPagamento
    });

    const itensDiscriminados = itensDetalhados.map(
      (it) => `${it.sku} - ${it.nome} (${it.quantidade} ${it.unidMedida} x R$ ${Number(it.precoUnitPratic).toFixed(2)})`
    );

    return {
      numeroCupomSat,
      chaveAcessoSat,
      xmlSatStatus: "EMITIDO",
      xmlConteudo,
      statusSefaz: "EMITIDO",
      itemDiscriminadoXml: itensDiscriminados.join(" | ")
    };
  }
}

module.exports = new SatFiscalService();
