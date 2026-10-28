# Sistema de Gestão de Estoque e Vendas — Loja Guarani (Loja do Turquinho)

Sistema corporativo de gestão de estoque físico, compras, balcão de vendas e emissão de CF-e-SAT da **Loja Guarani (Hacib Camasmie & Cia Ltda)**, tradicional comércio de aviamentos do Bom Retiro / São Paulo fundado em 1925.

Desenvolvido estritamente conforme as especificações dos **14 Casos de Uso (`UC01` a `UC14`)**, **24 Requisitos Funcionais (`RF01` a `RF24`)**, **10 Requisitos Não Funcionais (`RNF01` a `RNF10`)** e matriz de testes do **Capítulo 15**.

---

## 1. Arquitetura e Tecnologias

- **Monorepo Zero-Config:** `npm workspaces` gerenciando API e Web de forma unificada.
- **Backend (`loja-guarani-api`):** Node.js + Express (arquitetura MVC em 3 camadas: Rotas, Controllers Finos e Service Layer com transações ACID no Prisma).
- **Banco de Dados Portável:** SQLite com WAL mode, busy_timeout de 5000ms e triggers de integridade referencial/CHECK (`guarani.db`). Inclui também o script oficial PostgreSQL 16 3FN em `docs/ddl_postgresql16.sql`.
- **Adaptador Fiscal CF-e-SAT:** Emissor interno que gera XML homologado segundo o Layout 0.08 da SEFAZ-SP (Portaria CAT 147/2012) com chave de acesso de 44 dígitos e impressão de cupom fiscal em bobina térmica de 80mm.
- **Frontend (`loja-guarani-web`):** React 18 + Vite 5 (SPA em JavaScript / JSX) com Design System Loja Guarani (paleta Navy `#1E293B` / Turquesa `#0284C7`), tabela FEFO, accordions de lotes, badges semânticos e exportadores para PDF e Excel com cabeçalho institucional.
- **Testes Automatizados:** Suíte com Jest + Supertest cobrindo 100% dos cenários de teste do Capítulo 15.

---

## 2. Como Rodar o Sistema

### Pré-requisitos
- Node.js (versão 18, 20 ou 22 LTS)
- npm (versão 9 ou superior)

### 2.1. Instalação e Preparação (Primeira Execução)
```bash
# 1. Instalar todas as dependências do monorepo
npm install

# 2. Gerar Prisma Client, criar o banco SQLite com triggers e carregar a massa oficial de dados
npm run setup
```

### 2.2. Execução em Modo de Desenvolvimento
Executa a API na porta `3000` e o Vite com hot-reload na porta `5173`:
```bash
npm run dev
```
Acesse o sistema no navegador: **http://localhost:5173**

### 2.3. Execução Unificada em Modo de Produção
Compila o frontend e serve tudo sob uma única porta HTTP (`3000`):
```bash
npm start
```
Acesse o sistema no navegador: **http://localhost:3000**

### 2.4. Execução da Bateria Completa de Testes
```bash
npm test
```

---

## 3. Credenciais Pré-Cadastradas

| Perfil | Nome | E-mail de Login | Senha | Nível de Acesso |
| :--- | :--- | :--- | :--- | :--- |
| **Proprietário** | Roberto Camasmie | `roberto@lojaguarani.com.br` | `Guarani@1925` | **Acesso Total:** Cadastros, compras, recebimentos, validade, ajustes manuais e gestão de equipe. |
| **Proprietário** | Sérgio Camasmie | `sergio@lojaguarani.com.br` | `Guarani@1925` | **Acesso Total** |
| **Vendedor** | Carlos Vendedor | `vendedor1@lojaguarani.com.br` | `Balcao@2026` | **Operacional:** Balcão de atendimento, fechamento no caixa/SAT e consulta de saldo. Protegido por RNF10 e RBAC estrito. |

---

## 4. As 14 Telas Operacionais Construídas

1. **Tela 01 — Login (`LoginPage.jsx` / UC13):** Autenticação JWT 8h, bloqueio automático após 5 tentativas incorretas, validação de expediente (RNF10) e mascaramento de senha.
2. **Tela 02 — Dashboard (`DashboardPage.jsx` / UC14):** KPIs em tempo real, painel de alertas de estoque mínimo com atalho para emissão de OC, chave seletora ao vivo da regra RNF10 e modal de gestão de usuários.
3. **Tela 03 — Categorias (`CategoriasPage.jsx` / UC03):** Árvore hierárquica em 3 níveis (ex: `1`, `1.4`, `1.4.6`), modal de edição/criação e bloqueio de exclusão quando vinculada a produtos.
4. **Tela 04 — Produtos (`ProdutosPage.jsx` / UC03):** Gerenciamento em grid 4/8 colunas, auto-SKU incremental `>= 1000`, validação de NCM/EAN e bloqueio de exclusão física com histórico (RN05).
5. **Tela 05 — Locais Físicos (`LocaisPage.jsx` / UC04):** Mapeamento de gaveteiros e prateleiras com barras visuais de capacidade e ocupação percentual, bloqueando desativação de locais com saldo (RN06).
6. **Tela 06 — Fornecedores (`FornecedoresPage.jsx` / UC05):** Validação matemática de CNPJ com dígito verificador (módulo-11), vínculo com prazos de entrega e catálogo de produtos fornecidos.
7. **Tela 07 — Ordens de Compra (`OrdensCompraPage.jsx` / UC06):** Emissão exclusiva para fornecedores ativos, controle de status (`CRIADA`, `AGUARDANDO_RECEBIMENTO`, `PARCIALMENTE_ATENDIDA`, `ATENDIDA`, `CANCELADA`) e sugestão inteligente de reposição.
8. **Tela 08 — Recebimento de Lotes (`RecebimentoLotePage.jsx` / UC07/UC08):** Conferência física atômica vinculada a OC, validação cronológica (`dataValidade >= dataCompra`), alocação em múltiplos gaveteiros e trava de capacidade física (RN07).
9. **Tela 09 — Lotes em Sanfona (`LotesAccordionPage.jsx` / UC07/UC08):** Visualização em sanfona/accordion (Figura 27 do PDF) com saldos, fornecedores, datas e locais de armazenagem.
10. **Tela 10 — Pedido de Balcão (`PedidoBalcaoPage.jsx` / UC09):** Atendimento presencial rápido com busca preditiva, validação de quantidade mínima de venda (RN13), reserva temporária de estoque (RN14) e conformidade LGPD para dados de clientes.
11. **Tela 11 — Fechamento de Caixa & SAT (`CaixaVendaPage.jsx` / UC10/UC11):** Interface de checkout (Figura 26 do PDF), preview do algoritmo FIFO, emissão do CF-e-SAT em XML e bobina térmica com QR Code simulado e botão para teste de falha com rollback ACID integral.
12. **Tela 12 — Consulta de Posição de Estoque (`ConsultaEstoquePage.jsx` / UC01):** Consulta consolidada com tempo de resposta `< 3s`, saldo livre vs reservado, modal de rastreabilidade de lotes e exportação em PDF e Excel.
13. **Tela 13 — Relatório de Validade FEFO (`RelatorioValidadePage.jsx` / UC02):** Controle preventivo de perdas por expiração (First-Expired, First-Out), cards de valor monetário em risco, destaque semântico em âmbar/vermelho e atalho para baixa manual.
14. **Tela 14 — Ajuste Manual e Auditoria (`AjusteEstoquePage.jsx` / UC12):** Exclusivo da proprietária (RN19), validação de saldo local, observação obrigatória com no mínimo 15 caracteres e consulta à trilha imutável `movimentacoes_estoque` (RN20).

---

## 5. Atalhos Globais de Teclado

- **`F1`:** Abre o painel lateral deslizante (*Help Drawer*) com as instruções operacionais e regras de negócio da tela atual.
- **`F2`:** Navegação imediata para a tela de **Pedido no Balcão**.
- **`F3`:** Navegação imediata para a tela de **Consulta de Estoque em Tempo Real**.

---

## 6. Cobertura da Suíte de Testes Automatizados (Capítulo 15)

O comando `npm test` executa 15 testes de integração ponta a ponta com 100% de aprovação:

- **`CT-AUTH-01` & `CT-SEG-01`:** Hashing bcrypt, emissão de JWT, bloqueio após 5 falhas, bloqueio RBAC para rotas administrativas e mascaramento LGPD de CPF.
- **`CT-PROD-01` a `CT-PROD-04`:** Validação de campos obrigatórios, bloqueio de SKU duplicado, cálculo de auto-SKU e trava de exclusão física com histórico (RN05).
- **`CT-LOC-01`, `CT-LOC-02` & `CT-FORN-01`:** Capacidade de gaveteiros, trava de inativação com saldo e validação estrita de CNPJ com dígito verificador.
- **`CT-OC-01`, `CT-LOTE-01` a `CT-LOTE-04`:** Emissão de OC para fornecedor ativo, bloqueio de fornecedor inativo, conferência de datas e atendimento parcial/total.
- **`CT-PED-01`:** Validação de quantidade mínima de venda (RN13) e incremento/decremento atômico de `estoqueReservado` (RN14).
- **`CT-BAIXA-01`, `CT-BAIXA-02`, `CT-DB-01` & `CT-SAT-01`:** Algoritmo FIFO multi-lote, alerta automático de estoque mínimo (UC14), validação do XML CF-e-SAT (RN18) e garantia de Rollback ACID integral na falha da impressora fiscal.
- **`CT-AJUSTE-01`, `CT-AJUSTE-02` & `CT-DB-02`:** Justificativas válidas para ajuste (RN19), trava de observação com >= 15 caracteres e trigger no SQLite impedindo remoção de registros em `movimentacoes_estoque`.
- **`CT-CONS-01`, `CT-CONS-02`, `CT-VAL-01` & `CT-PERF-01`:** Consulta com filtros múltiplos, busca sem resultados, destaque de itens perecíveis a vencer e tempo de resposta `< 3000ms`.
