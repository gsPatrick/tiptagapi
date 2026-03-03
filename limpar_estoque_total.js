require("dotenv").config();
const { sequelize } = require("./src/models");

async function truncateIfExists(table) {
  try {
    await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
    console.log(`✅ TRUNCATE OK: ${table}`);
  } catch (err) {
    if (err.message.includes("does not exist")) {
      console.log(`⚠️ Ignorado (não existe): ${table}`);
      return;
    }
    throw err;
  }
}

async function main() {
  try {
    console.log("✅ Conectando no banco...");
    await sequelize.authenticate();
    console.log("✅ Conectado!");

    console.log("📌 Listando tabelas existentes...");
    const [tables] = await sequelize.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname='public'
      ORDER BY tablename;
    `);

    const existentes = tables.map(t => t.tablename);
    console.log("✅ Tabelas encontradas:", existentes.length);

    // 👇 Ordem segura: filhos -> pai
    const candidatas = [
      "movimentacoes_estoque",
      "movimentacao_estoque",
      "itens_pedido",
      "item_pedidos",
      "pedidos",
      "fotos_pecas",
      "foto_pecas",
      "foto_peca",
      "pecas",
    ];

    console.log("⚠️ APAGANDO tudo relacionado ao estoque...");

    for (const t of candidatas) {
      if (existentes.includes(t)) {
        await truncateIfExists(t);
      } else {
        console.log(`⚠️ Não está no banco: ${t}`);
      }
    }

    console.log("✅ Limpeza finalizada. Verificando pecas...");

    const [count] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM "pecas";`);
    console.log("📦 Total pecas agora:", count[0].total);

    console.log("✅ Estoque zerado com sucesso!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Erro ao limpar banco:", err.message);
    process.exit(1);
  }
}

main();
