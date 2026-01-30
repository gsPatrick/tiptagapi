const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Campanha extends Model {
        static associate(models) {
            // Associations
        }
    }
    Campanha.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        data_inicio: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        data_fim: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        desconto_percentual: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
        },
        ativa: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Campanha',
        tableName: 'campanhas',
        paranoid: true,
        timestamps: true,
    });
    return Campanha;
};
