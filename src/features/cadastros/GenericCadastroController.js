const {
    Tamanho,
    Cor,
    Categoria,
    Marca,
    Motivo,
    Politica,
    Local,
    OrigemVenda,
    DimensaoPadrao,
    ContaBancariaLoja,
    TipoDeReceitaDespesa,
    FormaPagamento,
    Notificacao
} = require('../../models');

const modelMap = {
    'tamanhos': Tamanho,
    'cores': Cor,
    'categorias': Categoria,
    'marcas': Marca,
    'motivos': Motivo,
    'politicas': Politica,
    'locais': Local,
    'origens': OrigemVenda,
    'dimensoes': DimensaoPadrao,
    'contas-loja': ContaBancariaLoja,
    'receitas-despesas': TipoDeReceitaDespesa,
    'contas-pessoa': require('../../models').ContaBancariaPessoa,
    'formas-pagamento': FormaPagamento,
    'notificacoes': Notificacao
};

class GenericCadastroController {

    _getModel(entidade) {
        const model = modelMap[entidade];
        if (!model) {
            throw new Error('Entidade não encontrada ou inválida');
        }
        return model;
    }

    async getAll(req, res) {
        try {
            const { entidade } = req.params;
            console.log(`[GenericCadastro] GetAll ${entidade} params:`, req.query);
            const model = this._getModel(entidade);

            const where = { ...req.query };

            // Case-insensitive search for 'nome'
            if (where.nome) {
                const { Sequelize } = require('../../models');
                const nomeValue = where.nome;
                delete where.nome;

                const items = await model.findAll({
                    where: {
                        ...where,
                        nome: Sequelize.where(
                            Sequelize.fn('lower', Sequelize.col('nome')),
                            Sequelize.fn('lower', nomeValue)
                        )
                    }
                });
                return res.json(items);
            }

            const items = await model.findAll({ where });
            return res.json(items);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async create(req, res) {
        try {
            const { entidade } = req.params;
            console.log(`[GenericCadastro] Create ${entidade} body:`, req.body);
            const model = this._getModel(entidade);
            const item = await model.create(req.body);

            // Sync Category or Brand if needed
            if (entidade === 'categorias') {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                ecommerceProvider.syncCategory(item).catch(console.error);
            } else if (entidade === 'marcas') {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                ecommerceProvider.syncBrand(item).catch(console.error);
            }

            return res.status(201).json(item);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async update(req, res) {
        try {
            const { entidade, id } = req.params;
            const model = this._getModel(entidade);
            const item = await model.findByPk(id);

            if (!item) {
                return res.status(404).json({ error: 'Registro não encontrado' });
            }

            await item.update(req.body);

            // Sync Category or Brand if needed
            if (entidade === 'categorias') {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                ecommerceProvider.syncCategory(item).catch(console.error);
            } else if (entidade === 'marcas') {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                ecommerceProvider.syncBrand(item).catch(console.error);
            }

            return res.json(item);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async delete(req, res) {
        try {
            const { entidade, id } = req.params;
            const model = this._getModel(entidade);
            const item = await model.findByPk(id);

            if (!item) {
                return res.status(404).json({ error: 'Registro não encontrado' });
            }

            await item.destroy();
            return res.status(204).send();
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async sync(req, res) {
        try {
            const { entidade, id } = req.params;

            // Support sync for categories, brands, sizes, and colors
            if (!['categorias', 'marcas', 'tamanhos', 'cores'].includes(entidade)) {
                return res.status(400).json({ error: 'Sincronização não suportada para esta entidade' });
            }

            const model = this._getModel(entidade);
            const item = await model.findByPk(id);

            if (!item) {
                return res.status(404).json({ error: 'Registro não encontrado' });
            }

            const ecommerceProvider = require('../integration/ecommerce.provider');
            let result;
            if (entidade === 'categorias') {
                result = await ecommerceProvider.syncCategory(item);
            } else if (entidade === 'marcas') {
                result = await ecommerceProvider.syncBrand(item);
            } else if (entidade === 'tamanhos') {
                result = await ecommerceProvider.syncSize(item);
            } else if (entidade === 'cores') {
                result = await ecommerceProvider.syncColor(item);
            }

            return res.json({ message: 'Sincronização realizada', ecommerceId: result });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new GenericCadastroController();
