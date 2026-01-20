const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class FormaPagamento extends Model {
        static associate(models) {
            // Associations
        }
    }
    FormaPagamento.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        taxa_percentual: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
        },
        dias_compensacao: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        gera_conta_receber: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        ativo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'FormaPagamento',
        tableName: 'formas_pagamento',
        paranoid: true,
        timestamps: true,
    });
    return FormaPagamento;
};
