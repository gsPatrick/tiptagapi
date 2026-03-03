const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContaCorrentePessoa extends Model {
        static associate(models) {
            ContaCorrentePessoa.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
            // referencia_origem can be polymorphic or just an ID.
            // We can add specific FKs if needed, e.g. pedidoId, repasseId.
        }
    }
    ContaCorrentePessoa.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pessoas', key: 'id' },
        },
        tipo: {
            type: DataTypes.ENUM('CREDITO', 'DEBITO'),
            allowNull: false,
        },
        valor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        referencia_origem: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        descricao: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        saldo_acumulado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        data_movimento: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'ContaCorrentePessoa',
        tableName: 'conta_corrente_pessoas',
        paranoid: true,
        timestamps: true,
    });
    return ContaCorrentePessoa;
};
