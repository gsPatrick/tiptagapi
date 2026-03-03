const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContratoPessoa extends Model {
        static associate(models) {
            ContratoPessoa.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
        }
    }
    ContratoPessoa.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        nome_exibicao: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        nome_arquivo: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        caminho: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mimetype: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        tamanho: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'ContratoPessoa',
        tableName: 'contratos_pessoa',
        timestamps: true,
    });
    return ContratoPessoa;
};
