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
    ContaBancariaLoja
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
    'contas-pessoa': require('../../models').ContaBancariaPessoa
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
            const model = this._getModel(entidade);
            const items = await model.findAll({ where: req.query });
            return res.json(items);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async create(req, res) {
        try {
            const { entidade } = req.params;
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
