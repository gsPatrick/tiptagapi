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
    FormaPagamento
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
    'formas-pagamento': FormaPagamento
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
}

module.exports = new GenericCadastroController();
