const pessoasService = require('./pessoas.service');

class PessoasController {
    async create(req, res) {
        try {
            const pessoa = await pessoasService.create(req.body);
            return res.status(201).json(pessoa);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getAll(req, res) {
        try {
            const filters = req.query;
            const pessoas = await pessoasService.getAll(filters);
            return res.json(pessoas);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getById(req, res) {
        try {
            const pessoa = await pessoasService.getById(req.params.id);
            if (!pessoa) return res.status(404).json({ error: 'Pessoa not found' });
            return res.json(pessoa);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async update(req, res) {
        try {
            const pessoa = await pessoasService.update(req.params.id, req.body);
            return res.json(pessoa);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async delete(req, res) {
        try {
            const result = await pessoasService.delete(req.params.id);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getSaldoPermuta(req, res) {
        try {
            const { id } = req.params;
            const saldo = await pessoasService.getSaldoPermuta(id);
            return res.json(saldo);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}

module.exports = new PessoasController();
