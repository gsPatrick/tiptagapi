'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pecas', 'preco_venda_sacolinha', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Preço negociado especificamente para a sacolinha'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('pecas', 'preco_venda_sacolinha');
  }
};
