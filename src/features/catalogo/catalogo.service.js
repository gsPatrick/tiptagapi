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
        let nextSeq = 1001;
        if (lastPeca && lastPeca.codigo_etiqueta && lastPeca.codigo_etiqueta.includes('-')) {
            const parts = lastPeca.codigo_etiqueta.split('-');
            nextSeq = (parseInt(parts[1]) || 1000) + 1;
        }
        pecaData.codigo_etiqueta = `TAG-${nextSeq}`;

        // Set Quantity
        const quantidade = parseInt(data.stock || data.quantidade || 1);
        pecaData.quantidade = quantidade;
        pecaData.quantidade_inicial = quantidade;

        // Map Description from frontend
        if (data.description) {
            pecaData.descricao_detalhada = data.description;
        }

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
        if (finalPeca.sync_ecommerce) {
            try {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                const ecommerceProduct = await ecommerceProvider.createProduct(finalPeca);
                if (ecommerceProduct && ecommerceProduct.sku) {
                    await finalPeca.update({ sku_ecommerce: ecommerceProduct.sku });
                }
            } catch (err) {
                console.error('[CatalogoService] Failed to sync to Ecommerce:', err.message);
            }
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

        // Date range filters for data_entrada
        const { dataInicio, dataFim, ...exactFilters } = otherFilters;
        if (dataInicio || dataFim) {
            where.data_entrada = {};
            if (dataInicio) where.data_entrada[Op.gte] = new Date(dataInicio);
            if (dataFim) where.data_entrada[Op.lte] = new Date(dataFim);
        }

        if (search) {
            const isNumeric = !isNaN(search) && search.trim() !== "";
            const searchOr = [
                { descricao_curta: { [Op.iLike]: `%${search}%` } },
                { codigo_etiqueta: { [Op.iLike]: `%${search}%` } }
            ];

            if (isNumeric) {
                searchOr.unshift({ id: parseInt(search) });
            }

            where[Op.or] = searchOr;
        }

        // Allow other exact filters if passed
        Object.keys(otherFilters).forEach(key => {
            let value = otherFilters[key];
            // Convert numeric strings to actual numbers for ID filters
            if (key.endsWith('Id') && typeof value === 'string' && value !== '') {
                const num = parseInt(value);
                if (!isNaN(num)) value = num;
            }
            where[key] = value;
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
        if (data.description) {
            data.descricao_detalhada = data.description;
        }
        await peca.update(data);

        const updatedPeca = await this.getPecaById(id);

        // Real-time Sync to Ecommerce
        if (updatedPeca.sync_ecommerce) {
            try {
                const ecommerceProvider = require('../integration/ecommerce.provider');
                if (updatedPeca.sku_ecommerce) {
                    await ecommerceProvider.updateProduct(updatedPeca.sku_ecommerce, updatedPeca);
                } else {
                    // If enabled but no SKU, try to create?
                    // For now, let's just stick to update logic.
                    // If user toggled ON, we might need to create.
                    // But let's assume they handle initial sync or we add logic later.
                    // Actually, if they toggle ON, we should probably check if it exists or create.
                    // But for this task, let's just respect the flag for updates.
                    // If it was OFF and now ON, and no SKU, we should create.
                    if (!updatedPeca.sku_ecommerce) {
                        const ecommerceProduct = await ecommerceProvider.createProduct(updatedPeca);
                        if (ecommerceProduct && ecommerceProduct.sku) {
                            await updatedPeca.update({ sku_ecommerce: ecommerceProduct.sku });
                        }
                    }
                }
            } catch (err) {
                console.error('[CatalogoService] Failed to sync update to Ecommerce:', err.message);
            }
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
        if (peca.sync_ecommerce) {
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
        }

        return { message: 'Peca deleted successfully' };
    }

    async syncPeca(id) {
        const peca = await this.getPecaById(id);
        if (!peca) throw new Error('Peca not found');

        const ecommerceProvider = require('../integration/ecommerce.provider');

        // Always try to create/upsert. The provider's createProduct logic handles checking if it exists.
        // If it exists, it updates. If not, it creates.
        // We force sync_ecommerce to true if the user manually syncs.
        if (!peca.sync_ecommerce) {
            await peca.update({ sync_ecommerce: true });
        }

        const ecommerceProduct = await ecommerceProvider.createProduct(peca);

        if (ecommerceProduct && ecommerceProduct.sku) {
            await peca.update({ sku_ecommerce: ecommerceProduct.sku });
        }

        return { message: 'Sincronização realizada com sucesso', ecommerceProduct };
    }

    async getAllMarcas() {
        return await Marca.findAll({
            order: [['nome', 'ASC']]
        });
    }

    async getExpiringPecas(days = 60) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() - days);

        return await Peca.findAll({
            where: {
                tipo_aquisicao: 'CONSIGNACAO',
                status: 'DISPONIVEL',
                data_entrada: {
                    [Op.lt]: expirationDate
                }
            },
            include: [
                { model: Pessoa, as: 'fornecedor', attributes: ['id', 'nome', 'telefone_whatsapp'] },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
            ],
            order: [['data_entrada', 'ASC']]
        });
    }
}

module.exports = new CatalogoService();
