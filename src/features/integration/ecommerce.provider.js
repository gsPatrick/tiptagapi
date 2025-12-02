const axios = require('axios');

class EcommerceProvider {
    constructor() {
        this.baseUrl = process.env.ECOMMERCE_API_URL;
        this.secret = process.env.INTEGRATION_SECRET;
        this.enabled = !!(this.baseUrl && this.secret);
    }

    async createProduct(peca) {
        if (!this.enabled) return null;

        try {
            const payload = this._mapPecaToPayload(peca);
            console.log(`[EcommerceProvider] Pushing ${peca.codigo_etiqueta} to Ecommerce...`);

            // Check existence first (Idempotency)
            // We can use the same logic as sync job: check by SKU
            if (payload.sku) {
                try {
                    const searchRes = await axios.get(`${this.baseUrl}/products?sku=${payload.sku}`, {
                        headers: { 'x-integration-secret': this.secret }
                    });
                    if (searchRes.data && searchRes.data.length > 0) {
                        const existingId = searchRes.data[0].id;
                        console.log(`[EcommerceProvider] Product ${payload.sku} already exists (ID: ${existingId}). Updating...`);
                        return await this.updateProduct(existingId, peca);
                    }
                } catch (err) {
                    // Ignore search error
                }
            }

            const response = await axios.post(`${this.baseUrl}/products`, payload, {
                headers: { 'x-integration-secret': this.secret }
            });

            console.log(`[EcommerceProvider] Created product in Ecommerce:`, response.data.id);
            return response.data;
        } catch (error) {
            console.error(`[EcommerceProvider] Error creating product:`, error.response?.data || error.message);
            return null;
        }
    }

    async updateProduct(ecommerceId, peca) {
        if (!this.enabled || !ecommerceId) return null;

        try {
            const payload = this._mapPecaToPayload(peca);
            console.log(`[EcommerceProvider] Updating product ${ecommerceId} in Ecommerce...`);

            const response = await axios.put(`${this.baseUrl}/products/${ecommerceId}`, payload, {
                headers: { 'x-integration-secret': this.secret }
            });

            console.log(`[EcommerceProvider] Updated product in Ecommerce.`);
            return response.data;
        } catch (error) {
            console.error(`[EcommerceProvider] Error updating product:`, error.response?.data || error.message);
            return null;
        }
    }

    _mapPecaToPayload(peca) {
        const payload = {
            name: peca.descricao_curta,
            description: peca.descricao_detalhada,
            price: peca.preco_venda,
            sku: peca.sku_ecommerce || peca.codigo_etiqueta,
            stock: peca.status === 'VENDIDA' ? 0 : 1,
            weight: peca.peso_kg,
            dimensions: {
                height: peca.altura_cm,
                width: peca.largura_cm,
                length: peca.profundidade_cm
            },
            brand: peca.marca?.nome,
            category: peca.categoria?.nome,
            attributes: [],
            status: peca.status === 'VENDIDA' ? 'archived' : 'published',
            brechoId: peca.id
        };

        if (peca.cor) payload.attributes.push({ name: 'Cor', options: [peca.cor.nome] });
        if (peca.tamanho) payload.attributes.push({ name: 'Tamanho', options: [peca.tamanho.nome] });

        return payload;
    }
}

module.exports = new EcommerceProvider();
