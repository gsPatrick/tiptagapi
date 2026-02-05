require('dotenv').config();
const { sequelize } = require('../src/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Database connected for migration.');

        const queryInterface = sequelize.getQueryInterface();

        // Verifique se a tabela já existe antes de tentar criar
        const tableExists = await sequelize.query(
            "SELECT to_regclass('public.contratos_pessoa');"
        );

        if (tableExists[0][0].to_regclass) {
            console.log('Tabela contratos_pessoa já existe, pulando criação.');
        } else {
            console.log('Creating table "contratos_pessoa"...');
            await queryInterface.createTable('contratos_pessoa', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: sequelize.Sequelize.INTEGER
                },
                pessoa_id: {
                    type: sequelize.Sequelize.INTEGER,
                    allowNull: false,
                    references: {
                        model: 'pessoas',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                nome_exibicao: {
                    type: sequelize.Sequelize.STRING,
                    allowNull: false
                },
                nome_arquivo: {
                    type: sequelize.Sequelize.STRING,
                    allowNull: false
                },
                caminho: {
                    type: sequelize.Sequelize.STRING,
                    allowNull: false
                },
                mimetype: {
                    type: sequelize.Sequelize.STRING,
                    allowNull: true
                },
                tamanho: {
                    type: sequelize.Sequelize.INTEGER,
                    allowNull: true
                },
                created_at: {
                    allowNull: false,
                    type: sequelize.Sequelize.DATE
                },
                updated_at: {
                    allowNull: false,
                    type: sequelize.Sequelize.DATE
                }
            });
            console.log('Table "contratos_pessoa" created successfully.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrate();
