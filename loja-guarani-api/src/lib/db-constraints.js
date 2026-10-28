async function configurarPragmas(prisma) {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
}

async function removerTriggerAppendOnlyParaSeed(prisma) {
  try {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS chk_mov_append_only_upd;");
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS chk_mov_append_only_del;");
  } catch (err) {
    // Ignore if triggers do not exist yet
  }
}

async function aplicarConstraintsBanco(prisma) {
  await configurarPragmas(prisma);
  const triggers = [
    `CREATE TRIGGER IF NOT EXISTS chk_lotes_qtd_ins BEFORE INSERT ON lotes
     WHEN NEW.quantidade_atual < 0 OR NEW.quantidade_recebida <= 0
     BEGIN SELECT RAISE(ABORT, 'check_violation: quantidade de lote invalida'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_lotes_qtd_upd BEFORE UPDATE ON lotes
     WHEN NEW.quantidade_atual < 0
     BEGIN SELECT RAISE(ABORT, 'check_violation: quantidade_atual nao pode ser negativa'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_lotes_datas_ins BEFORE INSERT ON lotes
     WHEN NEW.data_validade IS NOT NULL AND NEW.data_validade < NEW.data_compra
     BEGIN SELECT RAISE(ABORT, 'check_violation: data_validade anterior a data_compra'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_produtos_saldos_upd BEFORE UPDATE ON produtos
     WHEN NEW.estoque_atual < 0 OR NEW.estoque_reservado < 0 OR NEW.preco_p_unid <= 0
     BEGIN SELECT RAISE(ABORT, 'check_violation: saldo ou preco invalido em produtos'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_lote_local_qtd_upd BEFORE UPDATE ON lote_local
     WHEN NEW.quantidade < 0
     BEGIN SELECT RAISE(ABORT, 'check_violation: quantidade negativa em lote_local'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_locais_cap_ins BEFORE INSERT ON locais
     WHEN NEW.capacidade <= 0
     BEGIN SELECT RAISE(ABORT, 'check_violation: capacidade deve ser maior que zero'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_mov_append_only_upd BEFORE UPDATE ON movimentacoes_estoque
     BEGIN SELECT RAISE(ABORT, 'RN20: movimentacoes_estoque e imutavel (append-only)'); END;`,
    `CREATE TRIGGER IF NOT EXISTS chk_mov_append_only_del BEFORE DELETE ON movimentacoes_estoque
     BEGIN SELECT RAISE(ABORT, 'RN20: movimentacoes_estoque e imutavel (append-only)'); END;`
  ];

  for (const sql of triggers) {
    await prisma.$executeRawUnsafe(sql);
  }
}

module.exports = {
  configurarPragmas,
  removerTriggerAppendOnlyParaSeed,
  aplicarConstraintsBanco
};
