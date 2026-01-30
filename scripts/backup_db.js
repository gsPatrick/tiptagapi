const path = require('path');
const fs = require('fs');
const db = require('../src/models');

/**
 * Script de Backup do Banco de Dados (Versão Node/Sequelize)
 * Exporta as tabelas principais para arquivos JSON em caso de falha do pg_dump.
 */

async function backup() {
    console.log('--- Iniciando Backup de Dados (via Sequelize) ---');

    try {
        await db.sequelize.authenticate();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.resolve(__dirname, '../backups', `data_${timestamp}`);

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const tables = [
            'Peca', 'Pessoa', 'Marca', 'Categoria',
            'Cor', 'Tamanho', 'Local', 'Motivo',
            'MovimentacaoEstoque'
        ];

        for (const tableName of tables) {
            console.log(`Fazendo cópia da tabela: ${tableName}...`);
            const Model = db[tableName];
            if (!Model) {
                console.warn(`Aviso: Modelo ${tableName} não encontrado.`);
                continue;
            }

            const data = await Model.findAll({ paranoid: false }); // Include soft-deleted
            const filePath = path.join(backupDir, `${tableName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }

        console.log(`\nBackup concluído com sucesso!`);
        console.log(`Arquivos salvos em: ${backupDir}`);
        console.log('------------------------------------------');
    } catch (err) {
        console.error('ERRO FATAL no Backup:', err.message);
        process.exit(1);
    } finally {
        await db.sequelize.close();
    }
}

backup();
