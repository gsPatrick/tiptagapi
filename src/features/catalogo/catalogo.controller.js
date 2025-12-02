const catalogoService = require('./catalogo.service');

class CatalogoController {
    async createPeca(req, res) {
        try {
            const peca = await catalogoService.createPeca(req.body);
            return res.status(201).json(peca);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getAllPecas(req, res) {
        try {
            const filters = req.query;
            const pecas = await catalogoService.getAllPecas(filters);
            return res.json(pecas);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getPecaById(req, res) {
        try {
            const peca = await catalogoService.getPecaById(req.params.id);
            if (!peca) return res.status(404).json({ error: 'Peca not found' });
            return res.json(peca);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async updatePeca(req, res) {
        try {
            const peca = await catalogoService.updatePeca(req.params.id, req.body);
            return res.json(peca);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async generateEtiquetas(req, res) {
        try {
            const { ids } = req.body;
            const result = await catalogoService.generateEtiqueta(ids);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            // Return the full URL
            // Return relative path
            const url = `/uploads/${req.file.filename}`;
            return res.json({ url });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async deletePeca(req, res) {
        try {
            await catalogoService.deletePeca(req.params.id);
            return res.status(204).send();
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getAllMarcas(req, res) {
        try {
            const marcas = await catalogoService.getAllMarcas();
            return res.json(marcas);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new CatalogoController();
