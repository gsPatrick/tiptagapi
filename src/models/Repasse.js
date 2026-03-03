const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Repasse extends Model {
        static associate(models) {
            Repasse.belongsTo(models.Pessoa, { foreignKey: 'fornecedorId', as: 'fornecedor' });
        }
    }
    Repasse.init({
        fornecedorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pessoas', key: 'id' },
        },
        valor_total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        periodo_vendas_inicio: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        periodo_vendas_fim: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('AGENDADO', 'PAGO'),
            defaultValue: 'AGENDADO',
        },
        comprovante_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        data_pagamento: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Repasse',
        tableName: 'repasses',
        paranoid: true,
        timestamps: true,
    });
    return Repasse;
};
