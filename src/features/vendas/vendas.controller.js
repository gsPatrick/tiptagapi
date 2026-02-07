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



    async fecharSacolinha(req, res) {
        try {
            const { id } = req.params;
            const result = await vendasService.fecharSacolinha(id, req.body);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getSacolinhas(req, res) {
        try {
            const result = await vendasService.getSacolinhas(req.query);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getSacolinhaById(req, res) {
        try {
            const { id } = req.params;
            const result = await vendasService.getSacolinhaById(parseInt(id));
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async atualizarStatusSacolinha(req, res) {
        try {
            const { id } = req.params;
            const { status, codigo_rastreio } = req.body;
            const result = await vendasService.atualizarStatusSacolinha(parseInt(id), status, codigo_rastreio);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async adicionarItemSacolinha(req, res) {
        try {
            const { id } = req.params;
            const { pecaId } = req.body;
            const result = await vendasService.adicionarItemSacolinha(parseInt(id), parseInt(pecaId));
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async removerItemSacolinha(req, res) {
        try {
            const { id, pecaId } = req.params;
            const result = await vendasService.removerItemSacolinha(parseInt(id), parseInt(pecaId));
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getItensVendidos(req, res) {
        try {
            const { search } = req.query;
            const result = await vendasService.getItensVendidos(search);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async processarDevolucao(req, res) {
        try {
            const { pecaId } = req.body;
            const userId = req.userId; // Fixed: use req.userId from auth middleware
            const result = await vendasService.processarDevolucao(pecaId, userId);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getDevolucoes(req, res) {
        try {
            const result = await vendasService.getDevolucoes();
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getPedidos(req, res) {
        try {
            const result = await vendasService.getPedidos(req.query);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new VendasController();
