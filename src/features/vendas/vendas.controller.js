const vendasService = require('./vendas.service');

class VendasController {
    async pdv(req, res) {
        try {
            const result = await vendasService.processarVendaPDV(req.body, req.userId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async abrirSacolinha(req, res) {
        try {
            const { clienteId } = req.body;
            const result = await vendasService.abrirSacolinha(clienteId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async addItemSacolinha(req, res) {
        try {
            const { id } = req.params;
            const { pecaId } = req.body;
            const result = await vendasService.adicionarItemSacolinha(id, pecaId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async fecharSacolinha(req, res) {
        try {
            const { id } = req.params;
            const result = await vendasService.fecharSacolinha(id, req.body);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new VendasController();
