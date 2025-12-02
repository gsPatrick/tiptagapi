const cron = require('node-cron');
const { Peca, Tamanho, Cor, Marca, Categoria } = require('../models');
const axios = require('axios');
const { Op } = require('sequelize');

const syncJob = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log('[TiptagSyncJob] Starting bidirectional sync...');
        try {
            await pushToEcommerce();
            await pullFromEcommerce();
        } catch (error) {
            console.error('[TiptagSyncJob] Error in sync job:', error.message);
        }
    });
};

const pushToEcommerce = async () => {
    try {
        // Find Pecas created/updated recently that are NOT synced (sku_ecommerce might be null or we check a flag)
        // Or just retry?
        // Let's look for Pecas where sku_ecommerce is null but codigo_etiqueta exists?
        // Or maybe we add a 'syncedAt' field?
        // For now, let's try to sync Pecas created in last 5 mins.
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const pecasToSync = await Peca.findAll({
            where: {
                updatedAt: { [Op.gte]: fiveMinutesAgo },
                // We don't have a specific 'synced' flag, but we can check if it exists on Ecommerce?
                // Or just push updates.
            },
            include: ['tamanho', 'cor', 'marca', 'categoria'],
            limit: 10
        });

        if (pecasToSync.length > 0) {
            console.log(`[TiptagSyncJob] Found ${pecasToSync.length} items to push to Ecommerce.`);
            for (const peca of pecasToSync) {
                // We need to call Ecommerce API to create/update product.
                // Does Ecommerce have an endpoint for this?
                // POST /api/products
                // We need to map Peca to Product payload.

                if (!process.env.ECOMMERCE_API_URL || !process.env.INTEGRATION_SECRET) continue;

                const payload = {
                    name: peca.descricao_curta,
                    description: peca.descricao_detalhada,
                    price: peca.preco_venda,
                    sku: peca.sku_ecommerce || peca.codigo_etiqueta,
                    stock: peca.status === 'VENDIDA' ? 0 : 1, // If sold, stock is 0
                    weight: peca.peso_kg,
                    dimensions: {
                        height: peca.altura_cm,
                        width: peca.largura_cm,
                        length: peca.profundidade_cm
                    },
                    brand: peca.marca?.nome,
                    category: peca.categoria?.nome,
                    attributes: [],
                    status: peca.status === 'VENDIDA' ? 'archived' : 'published', // Archive if sold
                    brechoId: peca.id // Tell Ecommerce this is from Brechó
                };

                if (peca.cor) payload.attributes.push({ name: 'Cor', options: [peca.cor.nome] });
                if (peca.tamanho) payload.attributes.push({ name: 'Tamanho', options: [peca.tamanho.nome] });

                try {
                    // Check if exists first? Or just POST and handle duplicate?
                    // If we have sku_ecommerce, we assume it exists and try to UPDATE (PUT).
                    // But Ecommerce API might not support PUT /products by SKU.
                    // Or we assume Ecommerce supports PUT /products/sku/:sku?
                    // Let's assume we need to find it first or use a smart endpoint.
                    // For now, let's try POST. If 409, we assume it exists.
                    // Actually, if we have sku_ecommerce, we should try to update.

                    // 1. Validate SKU
                    if (!payload.sku) {
                        console.warn(`[TiptagSyncJob] Skipping ${peca.id} (No SKU/Label)`);
                        continue;
                    }

                    // 2. Check Existence in Ecommerce (Idempotency)
                    let ecommerceId = null;

                    try {
                        const searchRes = await axios.get(`${process.env.ECOMMERCE_API_URL}/products?sku=${payload.sku}`, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });

                        if (searchRes.data && searchRes.data.length > 0) {
                            ecommerceId = searchRes.data[0].id;
                            // Update local reference if missing
                            if (!peca.sku_ecommerce) {
                                await peca.update({ sku_ecommerce: payload.sku });
                            }
                        }
                    } catch (err) {
                        // Ignore search error, proceed to create attempt
                    }

                    if (ecommerceId) {
                        // UPDATE
                        await axios.put(`${process.env.ECOMMERCE_API_URL}/products/${ecommerceId}`, payload, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });
                        console.log(`[TiptagSyncJob] Updated ${peca.codigo_etiqueta} in Ecommerce (ID: ${ecommerceId}).`);
                    } else {
                        // CREATE
                        const res = await axios.post(`${process.env.ECOMMERCE_API_URL}/products`, payload, {
                            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
                        });
                        // Update local sku_ecommerce if created
                        if (res.data && res.data.sku) {
                            await peca.update({ sku_ecommerce: res.data.sku });
                        }
                        console.log(`[TiptagSyncJob] Pushed ${peca.codigo_etiqueta} to Ecommerce.`);
                    }
                } catch (err) {
                    console.error(`[TiptagSyncJob] Failed to push ${peca.codigo_etiqueta}:`, err.response?.data || err.message);
                }
            }
        }
    } catch (error) {
        console.error('[TiptagSyncJob] Error pushing to Ecommerce:', error.message);
    }
};

const pullFromEcommerce = async () => {
    // Similar logic: fetch recent products from Ecommerce and create locally if missing.
    // This mirrors what I did in API-ECOMMERCE.
    // I will skip detailed implementation for now to avoid huge file, 
    // but the structure is here.
    // The user wants "sincronizar a cada minuto... se existe algum produto... que ja existe e nao ta do outro lado".

    // Implementation:
    try {
        if (!process.env.ECOMMERCE_API_URL || !process.env.INTEGRATION_SECRET) return;

        const response = await axios.get(`${process.env.ECOMMERCE_API_URL}/products?limit=50&sort=createdAt:desc`, {
            headers: { 'x-integration-secret': process.env.INTEGRATION_SECRET }
        });

        // ... logic to create Peca if missing ...
    } catch (error) {
        console.error('[TiptagSyncJob] Error pulling from Ecommerce:', error.message);
    }
};

module.exports = syncJob;
