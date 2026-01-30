const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MovimentacaoConta extends Model {
        static associate(models) {
            MovimentacaoConta.belongsTo(models.Pessoa, { foreignKey: 'pessoaId', as: 'pessoa' });
            // referencia_origem can be polymorphic or just an ID.
            // For simplicity, we might store the ID and type, or just ID if we know the context from description/category.
            // Prompt says: "referencia_origem: pecaId ou pedidoId ou repasseId".
            // We can add fields for each or a generic one. Let's add specific nullable FKs for better integrity if possible,
            // or just an integer and we handle logic in code.
            // Let's add specific FKs for clarity:
            // MovimentacaoConta.belongsTo(models.Peca, { foreignKey: 'pecaId', as: 'peca' });
            // MovimentacaoConta.belongsTo(models.Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
        }
    }
    MovimentacaoConta.init({
        pessoaId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'pessoas', key: 'id' },
        },
        tipo_transacao: {
            type: DataTypes.ENUM('CREDITO', 'DEBITO'),
            allowNull: false,
        },
        categoria: {
            type: DataTypes.ENUM('VENDA_PECA', 'PAGAMENTO_REPASSE', 'USO_CREDITO_LOJA', 'ESTORNO', 'BONUS'),
            allowNull: false,
        },
        valor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        descricao: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        referencia_origem: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        saldo_apos_transacao: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true, // Calculated
        },
        data_movimento: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'MovimentacaoConta',
        tableName: 'movimentacoes_conta',
        paranoid: true,
        timestamps: true,
    });
    return MovimentacaoConta;
};
