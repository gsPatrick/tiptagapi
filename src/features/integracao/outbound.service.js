const axios = require('axios');

class OutboundService {
    constructor() {
        this.baseUrl = process.env.ECOMMERCE_API_URL;
        this.webhookSecret = process.env.ECOMMERCE_WEBHOOK_SECRET;
    }

    async notifyStockUpdate(peca) {
        if (!this.baseUrl) return;

        try {
            // Determine stock based on status
            // If DISPONIVEL -> 1, else 0
            const isAvailable = peca.status === 'DISPONIVEL';
            const stock = isAvailable ? 1 : 0;

            const payload = {
                sku: peca.sku_ecommerce || peca.codigo_etiqueta,
                status: peca.status,
                stock: stock
            };

            await axios.post(`${this.baseUrl}/integration/webhook/update-stock`, payload, {
                headers: {
                    'x-webhook-secret': this.webhookSecret
                }
            });

            console.log(`[Outbound] Notified E-commerce about ${payload.sku} (Status: ${payload.status})`);
        } catch (error) {
            console.error('[Outbound] Failed to notify E-commerce:', error.response?.data || error.message);
        }
    }
}

module.exports = new OutboundService();
