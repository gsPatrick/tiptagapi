const marketingService = require('./marketing.service');

class MarketingController {
    async createCampanha(req, res) {
        try {
            const campanha = await marketingService.createCampanha(req.body);
            return res.status(201).json(campanha);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getAllCampanhas(req, res) {
        try {
            const campanhas = await marketingService.getAllCampanhas();
            return res.json(campanhas);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // triggerBotMatch removed as per request

    async addProdutosToCampanha(req, res) {
        try {
            const { id } = req.params;
            const { pecaIds } = req.body;
            const result = await marketingService.addProdutosToCampanha(id, pecaIds);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async getProdutosCampanha(req, res) {
        try {
            const filters = req.query;
            const produtos = await marketingService.getProdutosCampanha(filters);
            return res.json(produtos);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async removeProdutosFromCampanha(req, res) {
        try {
            const { pecaIds } = req.body;
            const result = await marketingService.removeProdutosFromCampanha(pecaIds);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    async approveProdutos(req, res) {
        try {
            const { pecaIds } = req.body;
            const result = await marketingService.approveProdutos(pecaIds);
            return res.json(result);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new MarketingController();
