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
    async deleteProduct(ecommerceId) {
        if (!this.enabled || !ecommerceId) return null;

        try {
            console.log(`[EcommerceProvider] Deleting product ${ecommerceId} in Ecommerce...`);
            await axios.delete(`${this.baseUrl}/products/${ecommerceId}`, {
                headers: { 'x-integration-secret': this.secret }
            });
            console.log(`[EcommerceProvider] Deleted product in Ecommerce.`);
            return true;
        } catch (error) {
            console.error(`[EcommerceProvider] Error deleting product:`, error.response?.data || error.message);
            return null;
        }
    }

    async syncCategory(categoria) {
        if (!this.enabled) return null;
        try {
            console.log(`[EcommerceProvider] Syncing category ${categoria.nome}...`);
            // Check if exists by name (or slug if we had it, but name is unique enough for now)
            // Ideally we should store ecommerceId in Categoria model, but for now let's search by name
            const searchRes = await axios.get(`${this.baseUrl}/categories`, {
                params: { name: categoria.nome },
                headers: { 'x-integration-secret': this.secret }
            });

            const payload = {
                name: categoria.nome,
                image: categoria.foto ? (categoria.foto.startsWith('http') ? categoria.foto : `${process.env.TIPTAG_API_URL || this.baseUrl.replace('/api/v1', '')}${categoria.foto}`) : null,
                isActive: true
            };

            if (searchRes.data && searchRes.data.length > 0) {
                const existing = searchRes.data.find(c => c.name.toLowerCase() === categoria.nome.toLowerCase());
                if (existing) {
                    console.log(`[EcommerceProvider] Category exists (ID: ${existing.id}). Updating...`);
                    await axios.put(`${this.baseUrl}/categories/${existing.id}`, payload, {
                        headers: { 'x-integration-secret': this.secret }
                    });
                    return existing.id;
                }
            }

            console.log(`[EcommerceProvider] Creating category...`);
            const createRes = await axios.post(`${this.baseUrl}/categories`, payload, {
                headers: { 'x-integration-secret': this.secret }
            });
            return createRes.data.id;

        } catch (error) {
            console.error(`[EcommerceProvider] Error syncing category:`, error.response?.data || error.message);
            return null;
        }
    }

    _mapPecaToPayload(peca) {
        const payload = {
            name: peca.descricao_curta,
            description: peca.descricao_detalhada,
            price: peca.preco_venda,
            sku: peca.sku_ecommerce || peca.codigo_etiqueta,
            stock: peca.quantidade !== undefined ? peca.quantidade : (peca.status === 'VENDIDA' ? 0 : 1),
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
            brechoId: peca.id,
            images: peca.fotos ? peca.fotos.map(f => ({
                src: f.url.startsWith('http') ? f.url : `${process.env.TIPTAG_API_URL || this.baseUrl.replace('/api/v1', '')}${f.url}`
            })) : []
        };

        if (peca.cor) {
            payload.attributes.push({
                name: 'Cor',
                options: [peca.cor.nome],
                // If API supports custom metadata for attributes or if we send it as a separate field
                // For now, let's assume we send it as an option or metadata if supported.
                // Or maybe the 'options' is an object? { label: 'Azul', value: '#0000FF' }?
                // Standard Woocommerce/Magento usually just takes string.
                // But user said: "faz a pessoa conseguir colocar o nome e a cor igual no @[API-ECOMMERCE] pois qunado fizer a sincronizacao ja puxa a cor"
                // This implies if we send "Azul Bebê", and "Azul Bebê" exists in Ecommerce with the hex, it works.
                // OR we need to send the hex.
                // Let's try to send it in a way that might be accepted.
                // If not supported, at least we send the name.
                hex: peca.cor.hex
            });
        }
        if (peca.tamanho) payload.attributes.push({ name: 'Tamanho', options: [peca.tamanho.nome] });

        return payload;
    }
}

module.exports = new EcommerceProvider();
