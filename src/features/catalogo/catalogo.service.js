const { Peca, FotoPeca, Pessoa, Tamanho, Cor, Marca, Categoria, MovimentacaoEstoque } = require('../../models');
const { Op } = require('sequelize');

class CatalogoService {
    async createPeca(data, userId) {
        console.log('[CatalogoService] Creating Peca:', data);
        const { fotos, ...pecaData } = data;

        // Auto-generate sequential ID and label code
        // Find the highest existing TAG number to avoid duplicates
        const { sequelize } = require('../../models');
        const [maxResult] = await sequelize.query(
            `SELECT MAX(CAST(SPLIT_PART(codigo_etiqueta, '-', 2) AS INTEGER)) as max_num 
             FROM pecas 
             WHERE codigo_etiqueta LIKE 'TAG-%'`,
            { type: sequelize.QueryTypes.SELECT }
        );
        const maxNum = maxResult?.max_num || 1000;
        const nextSeq = maxNum + 1;
        pecaData.codigo_etiqueta = `TAG-${nextSeq}`;

        // Sanitize dimension fields - convert empty strings to 0
        const dimensionFields = ['peso_kg', 'altura_cm', 'largura_cm', 'profundidade_cm'];
        dimensionFields.forEach(field => {
            if (pecaData[field] === '' || pecaData[field] === undefined || pecaData[field] === null) {
                pecaData[field] = 0;
            }
        });

        // Sanitize foreign key fields - convert empty strings to null
        const fkFields = ['tamanhoId', 'corId', 'marcaId', 'categoriaId', 'fornecedorId'];
        fkFields.forEach(field => {
            if (pecaData[field] === '' || pecaData[field] === undefined) {
                pecaData[field] = null;
            }
        });

        // Sanitize price fields - convert empty strings to 0
        const priceFields = ['preco_venda', 'preco_custo'];
        priceFields.forEach(field => {
            if (pecaData[field] === '' || pecaData[field] === undefined || pecaData[field] === null) {
                pecaData[field] = 0;
            }
        });

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
        if (pecaData.tipo_aquisicao === 'CONSIGNACAO') {
            // Force 50/50 Split Rule
            // const fornecedor = await Pessoa.findByPk(pecaData.fornecedorId);
            // const comissaoPercent = fornecedor ? (parseFloat(fornecedor.comissao_padrao) || 50) : 50;

            const preco = parseFloat(pecaData.preco_venda || 0);
            const split = preco * 0.5;

            pecaData.valor_liquido_fornecedor = split;
            pecaData.valor_comissao_loja = split;

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
            let normalizedSearch = search.trim();
            // Handle "TAG 123" -> "TAG-123"
            if (/^TAG\s+\d+$/i.test(normalizedSearch)) {
                normalizedSearch = normalizedSearch.replace(/\s+/, '-').toUpperCase();
            }

            const isNumeric = !isNaN(normalizedSearch) && normalizedSearch !== "";
            const searchOr = [
                { descricao_curta: { [Op.iLike]: `%${normalizedSearch}%` } },
                { codigo_etiqueta: { [Op.iLike]: `%${normalizedSearch}%` } }
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
            distinct: true,
            include: [
                { model: FotoPeca, as: 'fotos' },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' },
                { model: Categoria, as: 'categoria' },
            ],
        };

        if (limit) {
            queryOptions.limit = parseInt(limit);
            if (page) {
                queryOptions.offset = (parseInt(page) - 1) * queryOptions.limit;
            }
        }
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

        const { rows, count } = await Peca.findAndCountAll(queryOptions);

        // --- ENFORCE 50/50 VIEW LOGIC ---
        const fixPeca = (p) => {
            const json = p.toJSON ? p.toJSON() : p;
            if (json.tipo_aquisicao === 'CONSIGNACAO') {
                const preco = parseFloat(json.preco_venda || 0);
                const split = (preco * 0.5).toFixed(2);
                json.valor_comissao_loja = split;
                json.valor_liquido_fornecedor = split;
            }
            return json;
        };

        const fixedRows = rows.map(fixPeca);
        // --------------------------------

        if (limit) {
            return {
                data: fixedRows,
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page)
            };
        }

        return fixedRows;
    }

    async getPecaById(id) {
        const peca = await Peca.findByPk(id, {
            include: [
                { model: FotoPeca, as: 'fotos' },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' },
                { model: Categoria, as: 'categoria' },
                { model: Pessoa, as: 'fornecedor' },
            ],
        });

        if (!peca) return null;

        // --- ENFORCE 50/50 VIEW LOGIC ---
        const json = peca.toJSON();
        if (json.tipo_aquisicao === 'CONSIGNACAO') {
            const preco = parseFloat(json.preco_venda || 0);
            const split = (preco * 0.5).toFixed(2);
            json.valor_comissao_loja = split;
            json.valor_liquido_fornecedor = split;
        }
        return json;
        // --------------------------------
    }

    async updatePeca(id, data) {
        const peca = await Peca.findByPk(id);
        if (!peca) throw new Error('Peca not found');

        const updateData = { ...data };

        // Sanitize foreign key fields - convert empty strings to null
        const fkFields = ['tamanhoId', 'corId', 'marcaId', 'categoriaId', 'fornecedorId'];
        fkFields.forEach(field => {
            if (updateData[field] === '' || updateData[field] === undefined) {
                updateData[field] = null;
            }
        });

        // Sanitize price fields - convert empty strings to 0
        const priceFields = ['preco_venda', 'preco_custo'];
        priceFields.forEach(field => {
            if (updateData[field] === '' || updateData[field] === undefined || updateData[field] === null) {
                updateData[field] = 0;
            }
        });

        // Sanitize dimension fields - convert empty strings to 0
        const dimensionFields = ['peso_kg', 'altura_cm', 'largura_cm', 'profundidade_cm'];
        dimensionFields.forEach(field => {
            if (updateData[field] === '' || updateData[field] === undefined || updateData[field] === null) {
                updateData[field] = 0;
            }
        });

        if (updateData.description) {
            updateData.descricao_detalhada = updateData.description;
        }

        const { fotos, ...cleanData } = updateData;

        // Validation: If assigning to a sacolinha, check piece status
        if (cleanData.sacolinhaId && cleanData.sacolinhaId !== peca.sacolinhaId) {
            if (peca.status === 'VENDIDA') {
                throw new Error('Não é possível adicionar uma peça já vendida a uma sacolinha');
            }
            if (peca.status === 'RESERVADA_SACOLINHA' && peca.sacolinhaId) {
                throw new Error('Esta peça já está reservada em outra sacolinha');
            }
            // Automatically set status to reflect reservation
            cleanData.status = 'RESERVADA_SACOLINHA';
        }

        await peca.update(cleanData);

        // Sync Photos if provided
        if (fotos && Array.isArray(fotos)) {
            // Remove existing
            await FotoPeca.destroy({ where: { pecaId: id } });

            // Create new
            if (fotos.length > 0) {
                const photosData = fotos.map((f, index) => {
                    const url = typeof f === 'string' ? f : (f.url || '');
                    return {
                        pecaId: id,
                        url,
                        ordem: index
                    };
                }).filter(p => p.url !== ''); // Don't save empty URLs

                await FotoPeca.bulkCreate(photosData);
            }
        }

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

    async reportAvaria(pecaId, mensagemAdicional, supplierId) {
        const { Notificacao } = require('../../models');
        let telefone, nomeFornecedor, itemDesc = '';

        if (pecaId) {
            const peca = await Peca.findByPk(pecaId, {
                include: [{ model: Pessoa, as: 'fornecedor' }]
            });
            if (!peca) throw new Error('Peça não encontrada');
            if (!peca.fornecedor) throw new Error('Esta peça não possui fornecedor vinculado');

            telefone = peca.fornecedor.telefone_whatsapp;
            nomeFornecedor = peca.fornecedor.nome;
            itemDesc = `*${peca.descricao_curta}* (TAG: ${peca.codigo_etiqueta})`;
        } else if (supplierId) {
            const supplier = await Pessoa.findByPk(supplierId);
            if (!supplier) throw new Error('Fornecedor não encontrado');
            telefone = supplier.telefone_whatsapp;
            nomeFornecedor = supplier.nome;
            itemDesc = 'um ou mais itens do seu lote';
        } else {
            throw new Error('É necessário informar a peça ou o fornecedor');
        }

        if (!telefone) throw new Error('Fornecedor não possui telefone WhatsApp cadastrado');

        const whatsappProvider = require('../../providers/whatsapp.provider');
        const msg = `Olá! Tudo bem?\n\nFinalizamos a curadoria das peças recebidas e tivemos alguns itens que não vamos permanecer.\n\nGostaríamos de saber se vocês preferem vir retirá-los em até 7 dias ou se podemos encaminhá-los para doação.\n\nFicamos no aguardo da orientação de vocês.\n\n♻️ *Garimpo Nós*`;

        const result = await whatsappProvider.enviarTexto(telefone, msg);

        // Also create a system notification for the admin
        await Notificacao.create({
            mensagem: `AVARIA: Alerta enviado para ${nomeFornecedor} sobre avaria detectada.`,
            tipo: 'ALERTA'
        });

        return { message: 'Aviso de avaria enviado ao fornecedor', result };
    }
}

module.exports = new CatalogoService();
