const { Peca, ItemPedido, Pedido, MovimentacaoEstoque, Sacolinha } = require('../src/models');
const { Sequelize } = require('sequelize');

async function checkItem() {
    try {
        const itemById = await Peca.findByPk(7141);
        if (itemById) {
            console.log('Item found by ID 7141:', itemById.toJSON());
        } else {
            console.log('Item ID 7141 not found.');
        }

        const itemByTag = await Peca.findOne({ where: { codigo_etiqueta: 'TAG-7141' } });
        if (itemByTag) {
            console.log('Item found by TAG-7141:', itemByTag.toJSON());
        }

        const targetItem = itemById || itemByTag;
        if (!targetItem) return;

        // Simulate getHistory logic
        const history = await MovimentacaoEstoque.findAll({
            where: { pecaId: targetItem.id },
            order: [['createdAt', 'DESC']],
            include: [{ model: Peca, as: 'peca' }]
        });
        console.log('History retrieved successfully:', history.length, 'records');
    } catch (error) {
        console.error('Error retrieving history:', error);
    }
}

// Call function... need proper DB connection setup
const sequelize = require('../src/models').sequelize;
checkItem().then(() => sequelize.close());
