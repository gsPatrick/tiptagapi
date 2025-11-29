const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContaPagarReceber extends Model {
        static associate(models) {
            ContaPagarReceber.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
            ContaPagarReceber.belongsTo(models.TipoDeReceitaDespesa, { foreignKey: 'categoriaId', as: 'categoria' });
        }
    }
    ContaPagarReceber.init({
        descricao: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'pessoas', key: 'id' },
        },
        tipo: {
            type: DataTypes.ENUM('PAGAR', 'RECEBER'),
            allowNull: false,
        },
        valor_previsto: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        valor_pago: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        data_vencimento: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        data_pagamento: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('ABERTO', 'PAGO', 'ATRASADO'),
            defaultValue: 'ABERTO',
        },
        categoriaId: {
            type: DataTypes.INTEGER,
            references: { model: 'tipos_receita_despesa', key: 'id' },
        },
    }, {
        sequelize,
        modelName: 'ContaPagarReceber',
        tableName: 'contas_pagar_receber',
        paranoid: true,
        timestamps: true,
    });
    return ContaPagarReceber;
};
