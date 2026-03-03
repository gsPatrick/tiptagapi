const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Endereco extends Model {
        static associate(models) {
            Endereco.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
        }
    }
    Endereco.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'pessoas',
                key: 'id',
            },
        },
        cep: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        rua: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        numero: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        comp: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        bairro: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        cidade: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        uf: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Endereco',
        tableName: 'enderecos',
        paranoid: true,
        timestamps: true,
    });
    return Endereco;
};
