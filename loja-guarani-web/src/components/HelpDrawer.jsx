import React from "react";
import { X, HelpCircle, BookOpen, CheckSquare, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";

const CONTEXTO_AJUDA = {
  "/": {
    titulo: "Painel Inicial (Dashboard & Alertas)",
    finalidade: "Visão executiva em tempo real com indicadores-chave, alertas preventivos de estoque mínimo e atalhos rápidos de balcão.",
    passos: [
      "Monitore os 4 cards executivos para acompanhar giro e validade.",
      "Utilize os atalhos rápidos (F2 Balcão, F3 Consulta) para atender em menos de 2 cliques.",
      "Verifique os alertas de estoque mínimo e clique em 'Gerar OC Preventiva' para acionar reposição imediata."
    ]
  },
  "/categorias": {
    titulo: "Gerenciamento de Categorias",
    finalidade: "Classificação em árvore mercadológica estruturada para organizar todo o acervo da loja.",
    passos: [
      "Preencha o Código Hierárquico (ex: 1, 1.4, 1.4.6) e o Nome da Categoria.",
      "Selecione a Categoria Pai caso se trate de uma subcategoria subordinada.",
      "Categorias com produtos ou subcategorias vinculados não podem ser excluídas fisicamente."
    ]
  },
  "/produtos": {
    titulo: "Catálogo de Produtos",
    finalidade: "Cadastro completo dos aviamentos com códigos SKU/EAN, especificações fiscais e parâmetros de reposição.",
    passos: [
      "Informe o código SKU (se omitido, o sistema gera o próximo número a partir de 1000).",
      "Defina unidade de medida, preço de venda base, quantidade mínima de venda e estoque mínimo.",
      "Produtos com movimentações históricas ficam restritos a inativação, impedindo perda de dados."
    ]
  },
  "/locais": {
    titulo: "Locais Físicos e Gaveteiros",
    finalidade: "Mapeamento dos gaveteiros, estantes e prateleiras da loja física da Rua Três Rios.",
    passos: [
      "Informe o código físico (ex: GAV-A-01, PRAT-03) e a capacidade máxima em unidades.",
      "A barra de progresso visual indica o percentual de ocupação em tempo real.",
      "Um local só pode ser inativado se estiver 100% vazio (saldo zero)."
    ]
  },
  "/fornecedores": {
    titulo: "Cadastro de Fornecedores",
    finalidade: "Registro formal de fabricantes e distribuidores parceiros com dados fiscais e prazos.",
    passos: [
      "Insira o CNPJ (o sistema valida os dígitos verificadores pelo algoritmo oficial da Receita).",
      "Defina as condições de pagamento habituais e prazos médios de entrega.",
      "Vincule produtos ao fornecedor com preço de custo acordado para apoiar cotações."
    ]
  },
  "/ordens-compra": {
    titulo: "Emissão de Ordem de Compra",
    finalidade: "Formalização de pedidos de reposição junto aos fornecedores ativos da loja.",
    passos: [
      "Selecione um fornecedor ativo e informe a previsão de entrega.",
      "Clique em 'Importar Itens em Alerta' para carregar automaticamente produtos abaixo do mínimo.",
      "Confirme a emissão da OC para registrá-la com status 'Aguardando Recebimento'."
    ]
  },
  "/recebimento": {
    titulo: "Recebimento de Lote",
    finalidade: "Registro da entrada física de mercadorias com vinculação aos gaveteiros e atualização de OC.",
    passos: [
      "Selecione a Ordem de Compra correspondente (ou realize entrada avulsa).",
      "Preencha o número do lote, data de compra, data de validade e quantidade contada.",
      "Distribua as unidades nos gaveteiros respeitando a capacidade máxima de cada local."
    ]
  },
  "/lotes": {
    titulo: "Inspeção de Lotes em Sanfona",
    finalidade: "Visualização progressiva por produto e controle detalhado de levas por data de entrada e validade.",
    passos: [
      "Utilize os filtros rápidos de lote e categoria no topo.",
      "Clique no Chevron (▼) ao lado de qualquer produto para expandir os lotes ativos.",
      "Acompanhe o saldo e o status de cada lote ordenado por prioridade PEPS/FIFO."
    ]
  },
  "/balcao": {
    titulo: "Pedido Presencial no Balcão",
    finalidade: "Atendimento ágil ao cliente, consulta física de gaveteiros e emissão de pré-pedidos com reserva.",
    passos: [
      "Busque o aviamento por SKU, código de barras ou nome para ver imediatamente o gaveteiro e saldo.",
      "Defina a quantidade solicitada (respeitando a quantidade mínima de venda).",
      "Mantenha 'Reservar Estoque Imediatamente' marcado para congelar o saldo enquanto o cliente vai ao caixa."
    ]
  },
  "/caixa": {
    titulo: "Fechamento de Venda e Caixa SAT",
    finalidade: "Baixa atômica de estoque por PEPS/FIFO e emissão do Cupom Fiscal Eletrônico (CF-e-SAT).",
    passos: [
      "Importe um Pedido em aberto do balcão ou lance itens diretamente no caixa.",
      "O Preview FIFO mostra em tempo real os lotes e gaveteiros que serão consumidos.",
      "Ao finalizar (F10), o sistema efetiva a transação ACID e gera o XML do CF-e-SAT individualizado."
    ]
  },
  "/consulta-estoque": {
    titulo: "Consulta de Posição de Estoque",
    finalidade: "Verificação instantânea de saldos consolidados e detalhes por gaveteiro com tempo de resposta < 3s.",
    passos: [
      "Combine filtros de busca, categoria, local físico e situação do saldo.",
      "Clique sobre qualquer linha para abrir o modal com detalhamento completo dos lotes.",
      "Exporte a listagem filtrada para PDF ou Excel (.xlsx) com cabeçalho institucional."
    ]
  },
  "/relatorio-validade": {
    titulo: "Relatório de Controle de Validade",
    finalidade: "Prevenção de perdas com monitoramento proativo de artigos perecíveis ordenados por FEFO/PEPS.",
    passos: [
      "Alterne entre as janelas pré-definidas (30, 60, 90 dias, Vencidos) ou período personalizado.",
      "Observe o card com o valor monetário total em risco de perda.",
      "Utilize o atalho 'Registrar Baixa por Vencimento' para abrir o ajuste manual já pré-preenchido."
    ]
  },
  "/ajuste-estoque": {
    titulo: "Ajuste Manual com Auditoria",
    finalidade: "Regularização de divergências de inventário com gravação de trilha imutável (exclusivo Proprietário).",
    passos: [
      "Selecione o produto, o lote e o gaveteiro específico que sofreu divergência.",
      "Escolha o tipo (Entrada ou Baixa) e a justificativa padronizada (Quebra, Vencimento, Roubo, Inventário).",
      "Descreva detalhadamente o motivo (mínimo de 15 caracteres) e confirme no modal de segurança."
    ]
  }
};

export function HelpDrawer({ isOpen, onClose }) {
  const location = useLocation();
  const infoAtual = CONTEXTO_AJUDA[location.pathname] || {
    titulo: "Ajuda do Sistema — Loja Guarani",
    finalidade: "Sistema Web de Gestão de Estoque e Vendas para a Loja Guarani (Loja do Turquinho - Desde 1925).",
    passos: [
      "Navegue pelo menu lateral para acessar os módulos de operação e gestão.",
      "Pressione F1 a qualquer momento para abrir ou fechar este painel de ajuda.",
      "Use F2 para ir direto ao Balcão e F3 para a Consulta de Estoque."
    ]
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ backgroundColor: "#1E293B", color: "#FFFFFF" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HelpCircle size={20} color="#60A5FA" />
            <h3 style={{ color: "#FFFFFF", fontSize: "16px" }}>Ajuda Contextual (F1)</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "4px"
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <BookOpen size={16} color="#1D4ED8" />
              <strong style={{ fontSize: "15px", color: "#0F172A" }}>{infoAtual.titulo}</strong>
            </div>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
              {infoAtual.finalidade}
            </p>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <CheckSquare size={16} color="#16A34A" />
              <strong style={{ fontSize: "14px", color: "#0F172A" }}>Instruções Passo a Passo:</strong>
            </div>
            <ol style={{ paddingLeft: "20px", fontSize: "13px", color: "#334155", display: "flex", flexDirection: "column", gap: "8px" }}>
              {infoAtual.passos.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ol>
          </div>

          <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <Sparkles size={16} color="#D97706" />
              <strong style={{ fontSize: "13px", color: "#0F172A" }}>Glossário & Regras da Loja:</strong>
            </div>
            <ul style={{ paddingLeft: "16px", fontSize: "12px", color: "#64748B", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong>SKU a partir de 1000:</strong> Numeração interna sequencial dos donos.</li>
              <li><strong>PEPS / FIFO:</strong> O primeiro lote que entra é o primeiro a ser vendido.</li>
              <li><strong>SAT (Portaria CAT 147):</strong> Discriminação individualizada item a item proibindo a expressão 'Aviamentos Diversos'.</li>
              <li><strong>Atalhos:</strong> F1 = Ajuda | F2 = Balcão | F3 = Consulta | F10 = Finalizar Venda.</li>
            </ul>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
          <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={onClose}>
            Fechar Ajuda
          </button>
        </div>
      </div>
    </div>
  );
}
