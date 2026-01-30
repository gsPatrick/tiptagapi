const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Configuracao extends Model {
        static associate(models) {
            // No associations needed usually
        }
    }
    Configuracao.init({
        chave: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        valor: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.STRING, // STRING, INT, JSON, BOOL
            defaultValue: 'STRING',
        },
        descricao: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Configuracao',
        tableName: 'configuracoes',
        paranoid: true,
        timestamps: true,
    });
    return Configuracao;
};
