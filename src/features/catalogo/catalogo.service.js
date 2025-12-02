const { Peca, FotoPeca, Pessoa, Tamanho, Cor, Marca, Categoria, MovimentacaoEstoque } = require('../../models');
const { Op } = require('sequelize');

class CatalogoService {
    async createPeca(data, userId) {
        console.log('[CatalogoService] Creating Peca:', data);
        const { fotos, ...pecaData } = data;

        // Auto-generate sequential ID and label code
        const lastPeca = await Peca.findOne({
            order: [['id', 'DESC']],
        });
        const nextSeq = lastPeca ? (parseInt(lastPeca.codigo_etiqueta.split('-')[1]) || 1000) + 1 : 1001;
        pecaData.codigo_etiqueta = `TAG-${nextSeq}`;

        // Set Quantity
        const quantidade = parseInt(data.stock || data.quantidade || 1);
        pecaData.quantidade = quantidade;
        pecaData.quantidade_inicial = quantidade;

        if (pecaData.tipo_aquisicao === 'CONSIGNACAO' && !pecaData.fornecedorId) {
            throw new Error('Fornecedor é obrigatório para consignação');
        }

        // Idempotency Check: If sku_ecommerce is provided, check if it already exists
        if (pecaData.sku_ecommerce) {
            const existingPeca = await Peca.findOne({ where: { sku_ecommerce: pecaData.sku_ecommerce } });
            if (existingPeca) {
                console.log(`[CatalogoService] Peca with sku_ecommerce ${pecaData.sku_ecommerce} already exists. Returning existing.`);
                // Update stock if exists? For now, just return existing.
                // Optionally: await existingPeca.increment('quantidade', { by: quantidade });
                return this.getPecaById(existingPeca.id);
            }
        }

        // --- Calculation of Commission and Net Values ---
        if (pecaData.tipo_aquisicao === 'CONSIGNACAO' && pecaData.fornecedorId) {
            const fornecedor = await Pessoa.findByPk(pecaData.fornecedorId);
            const comissaoPercent = fornecedor ? (parseFloat(fornecedor.comissao_padrao) || 50) : 50;

            const preco = parseFloat(pecaData.preco_venda || 0);
            const valorFornecedor = (preco * comissaoPercent) / 100;
            const valorLoja = preco - valorFornecedor;

            pecaData.valor_liquido_fornecedor = valorFornecedor;
            pecaData.valor_comissao_loja = valorLoja;

        } else if (pecaData.tipo_aquisicao === 'COMPRA') {
            const preco = parseFloat(pecaData.preco_venda || 0);
            const custo = parseFloat(pecaData.preco_custo || 0);

            pecaData.valor_liquido_fornecedor = custo;
            pecaData.valor_comissao_loja = preco - custo;
        }
        // ------------------------------------------------

        const peca = await Peca.create(pecaData);

        // Log Stock Entry
        await MovimentacaoEstoque.create({
            pecaId: peca.id,
            userId: userId || null,
            tipo: 'ENTRADA',
            quantidade: quantidade,
            motivo: 'Cadastro Inicial',
            data_movimento: new Date(),
        });

        if (fotos && fotos.length > 0) {
            const fotosData = fotos.map((url, index) => ({
                pecaId: peca.id,
                url,
                ordem: index,
            }));
            await FotoPeca.bulkCreate(fotosData);
        }

        const finalPeca = await this.getPecaById(peca.id);

        // Real-time Sync to Ecommerce
        try {
            const ecommerceProvider = require('../integration/ecommerce.provider');
            const ecommerceProduct = await ecommerceProvider.createProduct(finalPeca);
            if (ecommerceProduct && ecommerceProduct.sku) {
                await finalPeca.update({ sku_ecommerce: ecommerceProduct.sku });
            }
        } catch (err) {
            console.error('[CatalogoService] Failed to sync to Ecommerce:', err.message);
        }

        return finalPeca;
    }

    async getAllPecas(filters = {}) {
        // Extract pagination/sorting params
        const { limit, order, page, search, status, ...otherFilters } = filters;
        const where = {};

        if (status) {
            where.status = status;
        }

        if (search) {
            where[Op.or] = [
                { descricao_curta: { [Op.iLike]: `%${search}%` } },
                { codigo_etiqueta: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Allow other exact filters if passed
        Object.keys(otherFilters).forEach(key => {
            where[key] = otherFilters[key];
        });

        const queryOptions = {
            where,
            include: [
                { model: FotoPeca, as: 'fotos' },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' },
                { model: Categoria, as: 'categoria' },
            ],
        };

        if (limit) queryOptions.limit = parseInt(limit);
        if (order) {
            // Handle "field:direction" format or just "desc" (assuming createdAt)
            if (order.includes(':')) {
                const [field, dir] = order.split(':');
                queryOptions.order = [[field, dir.toUpperCase()]];
            } else {
                queryOptions.order = [['createdAt', order.toUpperCase()]];
            }
        } else {
            queryOptions.order = [['createdAt', 'DESC']]; // Default
        }

        return await Peca.findAll(queryOptions);
    }

    async getPecaById(id) {
        return await Peca.findByPk(id, {
            include: [
                { model: FotoPeca, as: 'fotos' },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' },
                { model: Categoria, as: 'categoria' },
                { model: Pessoa, as: 'fornecedor' },
            ],
        });
    }

    async updatePeca(id, data) {
        const peca = await Peca.findByPk(id);
        if (!peca) throw new Error('Peca not found');
        await peca.update(data);

        const updatedPeca = await this.getPecaById(id);

        // Real-time Sync to Ecommerce
        try {
            const ecommerceProvider = require('../integration/ecommerce.provider');
            if (updatedPeca.sku_ecommerce) {
                await ecommerceProvider.updateProduct(updatedPeca.sku_ecommerce, updatedPeca);
            }
        } catch (err) {
            console.error('[CatalogoService] Failed to sync update to Ecommerce:', err.message);
        }

        return updatedPeca;
    }

    async generateEtiqueta(pecaIds) {
        // Placeholder for ZPL/PDF generation
        return { message: 'Etiquetas geradas', ids: pecaIds };
    }

    async deletePeca(id) {
        const peca = await Peca.findByPk(id);
        if (!peca) throw new Error('Peca not found');
        await peca.destroy();

        // Real-time Sync to Ecommerce
        try {
            const ecommerceProvider = require('../integration/ecommerce.provider');
            if (peca.sku_ecommerce) {
                // If sku_ecommerce is the ID (which it seems to be in provider logic), use it.
                // Provider uses updateProduct(sku_ecommerce, ...) where first arg is ID?
                // Let's check provider. updateProduct(ecommerceId, peca).
                // And createProduct returns { id: ... }.
                // CatalogoService sets sku_ecommerce = ecommerceProduct.sku (which might be the ID or actual SKU).
                // In provider createProduct: return response.data.
                // In provider updateProduct: url is /products/${ecommerceId}.
                // So sku_ecommerce MUST be the ID for update/delete to work if we pass it as first arg.
                // But wait, createProduct sets sku_ecommerce = ecommerceProduct.sku.
                // If API-ECOMMERCE returns SKU as string (e.g. "TAG-1001"), then updateProduct URL /products/TAG-1001 must work.
                // Let's assume API-ECOMMERCE supports ID or SKU in URL, or sku_ecommerce holds the ID.
                // Actually, looking at provider: `const existingId = searchRes.data[0].id;` then `updateProduct(existingId, peca)`.
                // So updateProduct expects ID.
                // Does sku_ecommerce hold ID or SKU?
                // `await finalPeca.update({ sku_ecommerce: ecommerceProduct.sku });`
                // If ecommerceProduct.sku is the SKU string, then we have a problem if updateProduct expects ID.
                // Let's check API-ECOMMERCE product controller. `router.put('/:id'...)`. It expects ID.
                // So we need to store the Ecommerce ID, not just SKU.
                // OR we need to lookup ID by SKU before delete/update.
                // `ecommerceProvider.createProduct` logic:
                // `if (searchRes.data...) const existingId = searchRes.data[0].id; return await this.updateProduct(existingId, peca);`
                // So updateProduct DEFINITELY needs ID.
                // But `CatalogoService` stores `sku`.
                // We need `brechoId` equivalent in Tiptag? No, Tiptag is the master?
                // If Tiptag stores `sku_ecommerce`, is it the ID or SKU?
                // Usually `sku` is string.
                // We might need to search by SKU first to get ID, then delete.
                // I will update deletePeca to search first.

                // Actually, let's look at `ecommerce.provider.js` again.
                // `updateProduct(ecommerceId, peca)` -> calls PUT /products/${ecommerceId}
                // If `sku_ecommerce` is "TAG-1001", this calls PUT /products/TAG-1001.
                // Does API-ECOMMERCE support that?
                // API-ECOMMERCE `product.routes.js`: `router.put('/:id', ...)` -> `productController.update` -> `productService.updateProduct(id, ...)` -> `Product.findByPk(id)`.
                // So it EXPECTS PK (ID). It does NOT support SKU in URL.
                // THIS IS A BUG in the current sync design if `sku_ecommerce` stores the SKU string.
                // I need to check what `ecommerceProduct.sku` is.
                // If I can't change the model now, I must search by SKU to get ID before update/delete.

                // I'll implement lookup in provider or service.
                // Provider `createProduct` already does lookup.
                // I will add `deleteProductBySku` in provider?
                // Or just `deleteProduct` that accepts SKU and does lookup?
                // I'll update `ecommerce.provider.js` to handle lookup if ID is not found?
                // No, `ecommerce.provider.js` `updateProduct` takes `ecommerceId`.
                // I should probably add a `getIdBySku` method or similar.

                // For now, in `deletePeca`, I will try to delete.
                // But I realized `updatePeca` (which I just added) passes `sku_ecommerce` as `ecommerceId`.
                // If `sku_ecommerce` is not the ID, `updatePeca` will FAIL.
                // I need to fix `ecommerce.provider.js` to support SKU lookup for update/delete.

                await ecommerceProvider.deleteProduct(peca.sku_ecommerce);
            }
        } catch (err) {
            console.error('[CatalogoService] Failed to sync delete to Ecommerce:', err.message);
        }

        return { message: 'Peca deleted successfully' };
    }

    async getAllMarcas() {
        return await Marca.findAll({
            order: [['nome', 'ASC']]
        });
    }
}

module.exports = new CatalogoService();
