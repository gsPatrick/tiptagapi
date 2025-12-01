const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Peca extends Model {
        static associate(models) {
            Peca.belongsTo(models.Pessoa, { foreignKey: 'fornecedorId', as: 'fornecedor' });
            Peca.belongsTo(models.Tamanho, { foreignKey: 'tamanhoId', as: 'tamanho' });
            Peca.belongsTo(models.Cor, { foreignKey: 'corId', as: 'cor' });
            Peca.belongsTo(models.Marca, { foreignKey: 'marcaId', as: 'marca' });
            Peca.belongsTo(models.Categoria, { foreignKey: 'categoriaId', as: 'categoria' });
            Peca.belongsTo(models.Local, { foreignKey: 'localId', as: 'local' });
            Peca.belongsTo(models.Motivo, { foreignKey: 'motivoId', as: 'motivo' });
            Peca.belongsTo(models.Campanha, { foreignKey: 'campanhaId', as: 'campanha' });
            Peca.hasMany(models.FotoPeca, { foreignKey: 'pecaId', as: 'fotos' });
            Peca.hasMany(models.MovimentacaoEstoque, { foreignKey: 'pecaId', as: 'movimentacoes' });
            Peca.belongsTo(models.Sacolinha, { foreignKey: 'sacolinhaId', as: 'sacolinha' });
        }
    }
    Peca.init({
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            unique: true,
        },
        codigo_etiqueta: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true, // Generated logic
        },
        sku_ecommerce: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        descricao_curta: {
            type: DataTypes.STRING(70),
            allowNull: false,
        },
        descricao_detalhada: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        tipo_aquisicao: {
            type: DataTypes.ENUM('COMPRA', 'CONSIGNACAO', 'PERMUTA'),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('NOVA', 'EM_AUTORIZACAO', 'DISPONIVEL', 'RESERVADA_SACOLINHA', 'RESERVADA_ECOMMERCE', 'VENDIDA', 'DEVOLVIDA_FORNECEDOR', 'DOADA', 'EXTRAVIADA'),
            defaultValue: 'NOVA',
        },
        // Preços
        preco_custo: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        preco_venda: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        preco_promocional: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        valor_comissao_loja: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        valor_liquido_fornecedor: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        // Datas
        data_entrada: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        data_venda: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        data_saida_estoque: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        // Dimensões
        peso_kg: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0,
        },
        altura_cm: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        largura_cm: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        profundidade_cm: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        // FKs
        fornecedorId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'pessoas', key: 'id' },
        },
        tamanhoId: {
            type: DataTypes.INTEGER,
            references: { model: 'tamanhos', key: 'id' },
        },
        corId: {
            type: DataTypes.INTEGER,
            references: { model: 'cores', key: 'id' },
        },
        marcaId: {
            type: DataTypes.INTEGER,
            references: { model: 'marcas', key: 'id' },
        },
        categoriaId: {
            type: DataTypes.INTEGER,
            references: { model: 'categorias', key: 'id' },
        },
        localId: {
            type: DataTypes.INTEGER,
            references: { model: 'locais', key: 'id' },
        },
        motivoId: {
            type: DataTypes.INTEGER,
            references: { model: 'motivos', key: 'id' },
        },
        campanhaId: {
            type: DataTypes.INTEGER,
            references: { model: 'campanhas', key: 'id' },
            allowNull: true,
        },
        sacolinhaId: {
            type: DataTypes.INTEGER,
            references: { model: 'sacolinhas', key: 'id' },
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Peca',
        tableName: 'pecas',
        paranoid: true,
        timestamps: true,
        hooks: {
            afterUpdate: async (peca, options) => {
                // Avoid infinite loop if flag is set
                if (options.skipOutbound) return;

                // Notify E-commerce about status/stock change
                const outboundService = require('../features/integracao/outbound.service');
                outboundService.notifyStockUpdate(peca).catch(err =>
                    console.error('Background Outbound notification failed:', err.message)
                );
            }
        }
    });
    return Peca;
};
