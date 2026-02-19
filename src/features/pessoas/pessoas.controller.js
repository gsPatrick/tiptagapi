const pessoasService = require('./pessoas.service');

class PessoasController {
    async create(req, res) {
        try {
            const pessoa = await pessoasService.create(req.body);
            return res.status(201).json(pessoa);
        } catch (err) {
            if (err.errors && Array.isArray(err.errors)) {
                return res.status(400).json({ error: err.errors[0].message });
            }
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

    async uploadFoto(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            }
            const { id } = req.params;

            // Construct full URL
            const protocol = req.protocol;
            const host = req.get('host');
            const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

            const pessoa = await pessoasService.update(id, { foto: fileUrl });
            return res.json(pessoa);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // Contracts
    async addContrato(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            }
            const { id } = req.params;
            const { nome_exibicao } = req.body;

            const fileData = {
                nome_exibicao: nome_exibicao || req.file.originalname,
                nome_arquivo: req.file.originalname,
                caminho: `uploads/${req.file.filename}`,
                mimetype: req.file.mimetype,
                tamanho: req.file.size
            };

            const contrato = await pessoasService.addContrato(id, fileData);
            return res.status(201).json(contrato);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async updateContrato(req, res) {
        try {
            const { contratoId } = req.params;
            const contrato = await pessoasService.updateContrato(contratoId, req.body);
            return res.json(contrato);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async deleteContrato(req, res) {
        try {
            const { contratoId } = req.params;
            const result = await pessoasService.deleteContrato(contratoId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new PessoasController();
