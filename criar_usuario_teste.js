require('dotenv').config();
const { sequelize, User } = require('./src/models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco");

    const email = "teste.verificacao@marco.com";

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      console.log("⚠️ Usuário TESTE já existe:", existing.email, "id=", existing.id);
      process.exit(0);
    }

    const user = await User.create({
      nome: "USUARIO TESTE VERIFICACAO",
      email,
      senha_hash: "Teste123@",
      role: "ADMIN",
      ativo: true
    });

    console.log("✅ Usuário TESTE criado:", user.email, "id=", user.id);
    process.exit(0);

  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  }
}

main();
