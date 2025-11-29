const axios = require('axios');

class WhatsappProvider {
    constructor() {
        this.instanceId = process.env.ZAPI_INSTANCE_ID;
        this.token = process.env.ZAPI_TOKEN;
        this.clientToken = process.env.ZAPI_CLIENT_TOKEN;
        this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`;
    }

    async enviarTexto(telefone, mensagem) {
        if (!this.instanceId || !this.token) {
            console.warn('Z-API credentials not configured');
            return { error: 'Not configured' };
        }

        try {
            // Format phone: ensure DDI 55 and remove non-digits
            let phone = telefone.replace(/\D/g, '');
            if (!phone.startsWith('55') && phone.length <= 11) {
                phone = `55${phone}`;
            }

            const url = `${this.baseUrl}/send-text`;
            const headers = { 'Content-Type': 'application/json' };
            if (this.clientToken) {
                headers['Client-Token'] = this.clientToken;
            }

            const response = await axios.post(url, {
                phone,
                message: mensagem
            }, { headers });

            return response.data;
        } catch (err) {
            console.error('Error sending WhatsApp:', err.message);
            throw new Error(`Z-API Error: ${err.message}`);
        }
    }
}

module.exports = new WhatsappProvider();
