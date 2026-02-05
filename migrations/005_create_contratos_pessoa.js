'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('contratos_pessoa', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            pessoa_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'pessoas',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            nome_exibicao: {
                type: Sequelize.STRING,
                allowNull: false
            },
            nome_arquivo: {
                type: Sequelize.STRING,
                allowNull: false
            },
            caminho: {
                type: Sequelize.STRING,
                allowNull: false
            },
            mimetype: {
                type: Sequelize.STRING,
                allowNull: true
            },
            tamanho: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('contratos_pessoa');
    }
};
