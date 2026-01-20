const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

async function createTestUser() {
  try {
    const email = 'admin@tiptag.com.br';
    const password = '123';
    const hashedPassword = await bcrypt.hash(password, 8);

    console.log(`Verificando se usuário ${email} existe...`);
    const res = await pool.query('SELECT * FROM "users" WHERE email = $1', [email]);

    if (res.rows.length > 0) {
      console.log('Usuário já existe. Resetando senha...');
      // O model User.js usa 'senha_hash' e não 'password'
      await pool.query('UPDATE "users" SET senha_hash = $1 WHERE email = $2', [hashedPassword, email]);
      console.log('Senha atualizada.');
    } else {
      console.log('Usuário não existe. Criando...');
      // Ajustando colunas conforme User.js: nome, email, senha_hash, role
      await pool.query(
        'INSERT INTO "users" (nome, email, senha_hash, role, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
        ['Admin Teste', email, hashedPassword, 'ADMIN']
      );
      console.log('Usuário criado.');
    }
    
    await pool.end();
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    await pool.end();
  }
}

createTestUser();