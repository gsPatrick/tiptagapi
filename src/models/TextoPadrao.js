const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TextoPadrao extends Model {
        static associate(models) {
            // Associations
        }
    }
    TextoPadrao.init({
        titulo: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        conteudo: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        gatilho_automacao: {
            type: DataTypes.STRING, // ex: APOS_VENDA, ANIVERSARIO
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'TextoPadrao',
        tableName: 'textos_padrao',
        paranoid: true,
        timestamps: true,
    });
    return TextoPadrao;
};
