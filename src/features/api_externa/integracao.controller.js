const integracaoService = require('./integracao.service');

class IntegracaoController {
    async checkEstoque(req, res) {
        try {
            const { sku } = req.params;
            const result = await integracaoService.checkEstoque(sku);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async webhookPedido(req, res) {
        try {
            const result = await integracaoService.processarWebhookPedido(req.body);
            return res.status(201).json(result);
        } catch (err) {
            const status = err.status || 400;
            return res.status(status).json({ error: err.message });
        }
    }
}

module.exports = new IntegracaoController();
