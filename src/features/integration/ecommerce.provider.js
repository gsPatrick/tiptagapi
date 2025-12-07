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
            if (payload.sku) {
                try {
                    const searchRes = await axios.get(`${this.baseUrl}/products?sku=${payload.sku}`, {
                        headers: { 'x-integration-secret': this.secret }
                    });
                    const products = searchRes.data.data || searchRes.data;
                    if (Array.isArray(products) && products.length > 0) {
                        const existingId = products[0].id;
                        console.log(`[EcommerceProvider] Product ${payload.sku} already exists (ID: ${existingId}). Updating...`);
                        return await this.updateProduct(existingId, peca);
                    }
                } catch (err) {
                    // Ignore search error
                }
            }

            const response = await axios.post(`${this.baseUrl}/products`, payload, {
                headers: {
                    'x-integration-secret': this.secret,
                    'x-from-sync': 'true'
                }
            });

            console.log(`[EcommerceProvider] Created product in Ecommerce:`, response.data.id);
            return response.data;
        } catch (error) {
            console.error(`[EcommerceProvider] Error creating product:`, error.response?.data || error.message);
            return null;
        }
    }

    async updateProduct(ecommerceIdOrSku, peca) {
        if (!this.enabled || !ecommerceIdOrSku) return null;

        try {
            let ecommerceId = ecommerceIdOrSku;

            // If it looks like a SKU (string not purely numeric, or we just want to be safe), resolve it
            if (isNaN(ecommerceIdOrSku)) {
                console.log(`[EcommerceProvider] Resolving ID for SKU ${ecommerceIdOrSku}...`);
                const searchRes = await axios.get(`${this.baseUrl}/products?sku=${ecommerceIdOrSku}`, {
                    headers: { 'x-integration-secret': this.secret }
                });
                const products = searchRes.data.data || searchRes.data;

                if (Array.isArray(products) && products.length > 0) {
                    ecommerceId = products[0].id;
                } else {
                    console.warn(`[EcommerceProvider] Product with SKU ${ecommerceIdOrSku} not found for update.`);
                    return null;
                }
            }

            const payload = this._mapPecaToPayload(peca);
            console.log(`[EcommerceProvider] Updating product ${ecommerceId} in Ecommerce...`);

            const response = await axios.put(`${this.baseUrl}/products/${ecommerceId}`, payload, {
                headers: {
                    'x-integration-secret': this.secret,
                    'x-from-sync': 'true'
                }
            });

            console.log(`[EcommerceProvider] Updated product in Ecommerce.`);
            return response.data;
        } catch (error) {
            console.error(`[EcommerceProvider] Error updating product:`, error.response?.data || error.message);
            return null;
        }
    }

    async deleteProduct(ecommerceIdOrSku) {
        if (!this.enabled || !ecommerceIdOrSku) return null;

        try {
            let ecommerceId = ecommerceIdOrSku;

            if (isNaN(ecommerceIdOrSku)) {
                console.log(`[EcommerceProvider] Resolving ID for SKU ${ecommerceIdOrSku} to delete...`);
                const searchRes = await axios.get(`${this.baseUrl}/products?sku=${ecommerceIdOrSku}`, {
                    headers: { 'x-integration-secret': this.secret }
                });
                const products = searchRes.data.data || searchRes.data;

                if (Array.isArray(products) && products.length > 0) {
                    ecommerceId = products[0].id;
                } else {
                    console.warn(`[EcommerceProvider] Product with SKU ${ecommerceIdOrSku} not found for delete.`);
                    return null;
                }
            }

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
        // Logic for Stock: 0 if sold/reserved/returned, otherwise quantity or 1
        let stock = 1;
        const zeroStockStatuses = ['VENDIDA', 'RESERVADA_SACOLINHA', 'DEVOLVIDA_FORNECEDOR'];

        if (zeroStockStatuses.includes(peca.status)) {
            stock = 0;
        } else if (peca.quantidade !== undefined) {
            stock = peca.quantidade;
        }

        // Logic for Images: Ensure absolute URL using TIPTAG_API_URL
        const tiptagUrl = process.env.TIPTAG_API_URL || this.baseUrl.replace('/api/v1', '');

        const images = peca.fotos ? peca.fotos.map(f => ({
            src: f.url.startsWith('http') ? f.url : `${tiptagUrl}${f.url}`
        })) : [];

        const attributes = [];
        if (peca.cor) {
            attributes.push({
                name: 'Color', // Standardize to English for Ecommerce if needed, or keep 'Cor'
                options: [{
                    name: peca.cor.nome,
                    hex: peca.cor.hex || '#000000' // Ensure hex is present
                }]
            });
        }
        if (peca.tamanho) {
            attributes.push({
                name: 'Size', // Standardize to 'Size'
                options: [peca.tamanho.nome]
            });
        }

        const payload = {
            name: peca.descricao_curta,
            description: peca.descricao_detalhada,
            price: peca.preco_venda,
            sku: peca.sku_ecommerce || peca.codigo_etiqueta,
            stock: stock,
            weight: peca.peso_kg,
            dimensions: {
                height: peca.altura_cm,
                width: peca.largura_cm,
                length: peca.profundidade_cm
            },
            brand: peca.marca?.nome,
            category: peca.categoria?.nome,
            attributes: attributes,
            status: peca.status === 'VENDIDA' ? 'archived' : 'published',
            brechoId: peca.id,
            images: images,
            is_variable: attributes.length > 0 // Mark as variable if it has attributes
        };

        // If it has attributes, we should create a default variation so it appears in filters
        if (attributes.length > 0) {
            const variationAttributes = {};
            if (peca.cor) variationAttributes['Color'] = peca.cor.nome;
            if (peca.tamanho) variationAttributes['Size'] = peca.tamanho.nome;

            payload.variations = [{
                sku: `${payload.sku}-VAR`,
                price: payload.price,
                stock: payload.stock,
                attributes: variationAttributes,
                images: images // Inherit images
            }];
        }

        return payload;
    }
}

module.exports = new EcommerceProvider();
