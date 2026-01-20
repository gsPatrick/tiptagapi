const express = require('express');
const router = express.Router();
const integracaoController = require('./integracao.controller');

// Simple API Key Middleware
const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY_INTEGRACAO) {
        // For dev simplicity, if env not set, maybe allow or block. Let's block.
        if (!process.env.API_KEY_INTEGRACAO) {
            console.warn('API_KEY_INTEGRACAO not set in env');
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.use(apiKeyMiddleware);

router.get('/estoque/:sku', integracaoController.checkEstoque);
router.post('/webhook/pedido', integracaoController.webhookPedido);

module.exports = router;
