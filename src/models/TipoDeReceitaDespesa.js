const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TipoDeReceitaDespesa extends Model {
        static associate(models) {
            // Associations
        }
    }
    TipoDeReceitaDespesa.init({
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.ENUM('RECEITA', 'DESPESA'),
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'TipoDeReceitaDespesa',
        tableName: 'tipos_receita_despesa',
        paranoid: true,
        timestamps: true,
    });
    return TipoDeReceitaDespesa;
};
