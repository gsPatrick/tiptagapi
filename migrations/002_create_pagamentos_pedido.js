const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Verifique se a tabela já existe antes de tentar criar
    const tableExists = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.pagamentos_pedido');"
    );

    // O resultado pode variar dependendo do driver, mas geralmente retorna [{ to_regclass: 'nome_tabela' }] ou [{ to_regclass: null }]
    if (tableExists[0][0].to_regclass) {
      console.log('Tabela pagamentos_pedido já existe, pulando criação.');
      return;
    }

    await queryInterface.createTable('pagamentos_pedido', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      pedidoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      metodo: {
        type: Sequelize.ENUM('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'CREDITO_LOJA', 'VOUCHER_PERMUTA'),
        allowNull: false
      },
      valor: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      parcelas: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      taxa_processamento: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deleted_at: {
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pagamentos_pedido');
  }
};
