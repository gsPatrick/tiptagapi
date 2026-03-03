require('dotenv').config();
const { TextoPadrao, sequelize } = require('./src/models');

async function checkTemplates() {
    try {
        await sequelize.authenticate();
        const templates = await TextoPadrao.findAll();
        console.log('--- TEMPLATES NO BANCO ---');
        templates.forEach(t => {
            console.log(`Gatilho: ${t.gatilho_automacao}`);
            console.log(`Título: ${t.titulo}`);
            console.log(`Conteúdo:\n${t.conteudo}\n`);
            console.log('---------------------------');
        });
    } catch (error) {
        console.error('ERRO:', error);
    } finally {
        await sequelize.close();
    }
}

checkTemplates();
