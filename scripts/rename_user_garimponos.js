/**
 * Script para renomear usuário "Alcateia Admin" para "Garimponos"
 * Execute com: node scripts/rename_user_garimponos.js
 */

require('dotenv').config();
const { sequelize, User } = require('../src/models');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('Conectado ao banco de dados.');

        // Buscar o usuário
        const user = await User.findOne({
            where: { nome: 'Alcateia Admin' }
        });

        if (!user) {
            console.log('Usuário "Alcateia Admin" não encontrado.');
            console.log('\nListando todos os usuários:');
            const allUsers = await User.findAll({ attributes: ['id', 'nome', 'email'] });
            allUsers.forEach(u => console.log(`  ID ${u.id}: ${u.nome} (${u.email})`));
            process.exit(0);
        }

        console.log(`Encontrado: ID ${user.id} - ${user.nome}`);

        // Atualizar o nome
        await user.update({ nome: 'Garimponos' });

        console.log('✅ Nome atualizado para "Garimponos" com sucesso!');

        process.exit(0);
    } catch (err) {
        console.error('Erro:', err.message);
        process.exit(1);
    }
}

main();
