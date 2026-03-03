const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Sacolinha extends Model {
        static associate(models) {
            Sacolinha.belongsTo(models.Pessoa, { foreignKey: 'clienteId', as: 'cliente' });
            Sacolinha.hasMany(models.Peca, { foreignKey: 'sacolinhaId', as: 'itens' });
        }
    }
    Sacolinha.init({
        clienteId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pessoas', key: 'id' },
        },
        status: {
            type: DataTypes.ENUM('ABERTA', 'PRONTA', 'ENVIADA', 'FECHADA', 'FECHADA_VIRAR_PEDIDO', 'CANCELADA'),
            defaultValue: 'ABERTA',
        },
        data_abertura: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        data_vencimento: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        codigo_rastreio: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Sacolinha',
        tableName: 'sacolinhas',
        paranoid: true,
        timestamps: true,
    });
    return Sacolinha;
};
