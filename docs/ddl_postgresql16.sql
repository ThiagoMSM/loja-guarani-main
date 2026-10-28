-- Sistema de Gestão de Estoque e Vendas — Loja Guarani (Hacib Camasmie & Cia Ltda)
-- Script DDL Oficial PostgreSQL 16 (Normalizado até 3FN)

CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email_login VARCHAR(120) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('PROPRIETARIO', 'VENDEDOR')),
  status VARCHAR(10) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
  tentativas_falhas INTEGER NOT NULL DEFAULT 0,
  ultimo_acesso TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE categorias (
  id_categ SERIAL PRIMARY KEY,
  codigo_hierarquico VARCHAR(20) UNIQUE,
  nome VARCHAR(60) NOT NULL,
  descricao VARCHAR(200),
  id_categ_pai INTEGER REFERENCES categorias(id_categ)
);

CREATE TABLE fornecedores (
  id_fornec SERIAL PRIMARY KEY,
  cnpj VARCHAR(18) NOT NULL UNIQUE,
  raz_social VARCHAR(120) NOT NULL,
  nome_fantasia VARCHAR(120),
  contato_principal VARCHAR(80),
  status VARCHAR(10) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  telefone VARCHAR(20),
  email VARCHAR(120),
  endereco VARCHAR(200),
  condicoes_pagto_padrao VARCHAR(100)
);

CREATE TABLE locais (
  id_local SERIAL PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  capacidade INTEGER NOT NULL CHECK (capacidade > 0),
  status VARCHAR(10) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  descricao VARCHAR(200)
);

CREATE TABLE produtos (
  id_prod SERIAL PRIMARY KEY,
  sku VARCHAR(30) NOT NULL UNIQUE,
  ean VARCHAR(20),
  ncm VARCHAR(8) NOT NULL DEFAULT '54011012',
  cfop_padrao VARCHAR(4) NOT NULL DEFAULT '5102',
  nome VARCHAR(120) NOT NULL,
  descricao VARCHAR(300),
  unid_medida VARCHAR(10) NOT NULL,
  preco_p_unid DECIMAL(10,2) NOT NULL CHECK (preco_p_unid > 0),
  qtd_minima_venda INTEGER NOT NULL DEFAULT 1 CHECK (qtd_minima_venda > 0),
  estoque_atual INTEGER NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  estoque_reservado INTEGER NOT NULL DEFAULT 0 CHECK (estoque_reservado >= 0),
  estoque_min INTEGER NOT NULL DEFAULT 0 CHECK (estoque_min >= 0),
  status VARCHAR(10) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  id_categ INTEGER NOT NULL REFERENCES categorias(id_categ)
);

CREATE TABLE lotes (
  id_lote SERIAL PRIMARY KEY,
  num_lote VARCHAR(30) NOT NULL,
  id_prod INTEGER NOT NULL REFERENCES produtos(id_prod),
  id_fornec INTEGER REFERENCES fornecedores(id_fornec),
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_compra DECIMAL(10,2) NOT NULL CHECK (valor_compra >= 0),
  data_fabricacao DATE,
  data_validade DATE,
  quantidade_recebida INTEGER NOT NULL CHECK (quantidade_recebida > 0),
  quantidade_atual INTEGER NOT NULL CHECK (quantidade_atual >= 0),
  status VARCHAR(15) NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL', 'ESGOTADO', 'VENCIDO', 'BLOQUEADO')),
  UNIQUE (id_prod, num_lote),
  CONSTRAINT chk_datas_lote CHECK (data_validade IS NULL OR data_validade >= data_compra)
);

CREATE TABLE produto_fornecedor (
  id_prod INTEGER NOT NULL REFERENCES produtos(id_prod),
  id_fornec INTEGER NOT NULL REFERENCES fornecedores(id_fornec),
  preco_custo_acordado DECIMAL(10,2),
  lead_time_dias INTEGER DEFAULT 7,
  PRIMARY KEY (id_prod, id_fornec)
);

CREATE TABLE lote_local (
  id_lote INTEGER NOT NULL REFERENCES lotes(id_lote),
  id_local INTEGER NOT NULL REFERENCES locais(id_local),
  quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
  PRIMARY KEY (id_lote, id_local)
);

CREATE TABLE vendedores (
  id_vend SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL UNIQUE REFERENCES usuarios(id_usuario),
  cpf VARCHAR(14) NOT NULL UNIQUE,
  cargo VARCHAR(40) NOT NULL DEFAULT 'Vendedor Balconista',
  telefone VARCHAR(20),
  email VARCHAR(120)
);

CREATE TABLE clientes (
  id_cliente SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  cpf_cnpj VARCHAR(18) UNIQUE,
  status VARCHAR(10) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  telefone VARCHAR(20),
  endereco VARCHAR(200),
  email VARCHAR(120)
);

CREATE TABLE ordens_compra (
  id_oc SERIAL PRIMARY KEY,
  id_fornec INTEGER NOT NULL REFERENCES fornecedores(id_fornec),
  id_usuario_emissor INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  data_emissao TIMESTAMP NOT NULL DEFAULT NOW(),
  data_entrega_prevista DATE,
  condicoes_pagto VARCHAR(100),
  valor_total_estimado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(25) NOT NULL DEFAULT 'AGUARDANDO_RECEBIMENTO'
);

CREATE TABLE itens_oc (
  id_oc INTEGER NOT NULL REFERENCES ordens_compra(id_oc) ON DELETE CASCADE,
  id_prod INTEGER NOT NULL REFERENCES produtos(id_prod),
  quantidade_pedida INTEGER NOT NULL CHECK (quantidade_pedida > 0),
  quantidade_recebida INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
  preco_unit_compra DECIMAL(10,2) NOT NULL CHECK (preco_unit_compra >= 0),
  PRIMARY KEY (id_oc, id_prod)
);

CREATE TABLE pedidos_venda (
  id_pedido SERIAL PRIMARY KEY,
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  id_vend INTEGER NOT NULL REFERENCES vendedores(id_vend),
  data_pedido TIMESTAMP NOT NULL DEFAULT NOW(),
  reserva_ativa BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(25) NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO'
);

CREATE TABLE vendas (
  id_venda SERIAL PRIMARY KEY,
  id_pedido INTEGER REFERENCES pedidos_venda(id_pedido),
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  id_vend INTEGER NOT NULL REFERENCES vendedores(id_vend),
  data_venda TIMESTAMP NOT NULL DEFAULT NOW(),
  forma_pagamento VARCHAR(20) NOT NULL,
  desconto DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (desconto >= 0),
  valor_total DECIMAL(10,2) NOT NULL CHECK (valor_total >= 0),
  numero_cupom_sat VARCHAR(20),
  chave_acesso_sat VARCHAR(44) UNIQUE,
  xml_sat_status VARCHAR(20) NOT NULL DEFAULT 'EMITIDO',
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA'
);

CREATE TABLE itens_venda (
  id_venda INTEGER NOT NULL REFERENCES vendas(id_venda) ON DELETE CASCADE,
  id_lote INTEGER NOT NULL REFERENCES lotes(id_lote),
  id_prod INTEGER NOT NULL REFERENCES produtos(id_prod),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unit_pratic DECIMAL(10,2) NOT NULL CHECK (preco_unit_pratic > 0),
  cfop_aplicado VARCHAR(4) NOT NULL DEFAULT '5102',
  ncm_aplicado VARCHAR(8) NOT NULL,
  PRIMARY KEY (id_venda, id_lote)
);

CREATE TABLE movimentacoes_estoque (
  id_mov SERIAL PRIMARY KEY,
  id_lote INTEGER NOT NULL REFERENCES lotes(id_lote),
  id_local INTEGER REFERENCES locais(id_local),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'BAIXA')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  justificativa VARCHAR(20) NOT NULL CHECK (justificativa IN ('QUEBRA', 'VENCIMENTO', 'ROUBO', 'INVENTARIO', 'RECEBIMENTO', 'VENDA')),
  observacao VARCHAR(255),
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  data_hora TIMESTAMP NOT NULL DEFAULT NOW()
);
