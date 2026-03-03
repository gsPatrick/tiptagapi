const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContaBancariaPessoa extends Model {
        static associate(models) {
            ContaBancariaPessoa.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
        }
    }
    ContaBancariaPessoa.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'pessoas',
                key: 'id',
            },
        },
        banco: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        agencia: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        conta: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'ContaBancariaPessoa',
        tableName: 'contas_bancarias_pessoa',
        paranoid: true,
        timestamps: true,
    });
    return ContaBancariaPessoa;
};
