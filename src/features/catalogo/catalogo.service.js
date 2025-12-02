const { Peca, FotoPeca, Pessoa, Tamanho, Cor, Marca, Categoria, MovimentacaoEstoque } = require('../../models');
const { Op } = require('sequelize');

class CatalogoService {
    async createPeca(data, userId) {
        console.log('[CatalogoService] Creating Peca:', data);
        const { fotos, ...basePecaData } = data;
        const quantidade = parseInt(data.stock || data.quantidade || 1);
        const createdItems = [];

        // 1. Get last sequence ONCE to avoid race conditions in loop (simple approach)
        const lastPeca = await Peca.findOne({
            order: [['id', 'DESC']],
        });
        let nextSeq = lastPeca ? (parseInt(lastPeca.codigo_etiqueta.split('-')[1]) || 1000) + 1 : 1001;

        // 2. Loop for Batch Creation
        for (let i = 0; i < quantidade; i++) {
            const pecaData = { ...basePecaData }; // Clone for each iteration

            // Generate Unique TAG
            pecaData.codigo_etiqueta = `TAG-${nextSeq + i}`;

            // Handle SKU for batch: if multiple, append suffix to avoid duplicates if SKU provided
            if (quantidade > 1 && pecaData.sku_ecommerce) {
                pecaData.sku_ecommerce = `${pecaData.sku_ecommerce}-${i + 1}`;
            }

            if (pecaData.tipo_aquisicao === 'CONSIGNACAO' && !pecaData.fornecedorId) {
                throw new Error('Fornecedor é obrigatório para consignação');
            }

            // Idempotency Check (Only for single item creation)
            if (quantidade === 1 && pecaData.sku_ecommerce) {
                const existingPeca = await Peca.findOne({ where: { sku_ecommerce: pecaData.sku_ecommerce } });
                if (existingPeca) {
                    console.log(`[CatalogoService] Peca with sku_ecommerce ${pecaData.sku_ecommerce} already exists. Returning existing.`);
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
                quantidade: 1,
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

            createdItems.push(finalPeca);
        }

        // Return single item if only 1 requested (backward compatibility), else array
        return quantidade === 1 ? createdItems[0] : createdItems;
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
        return this.getPecaById(id);
    }

    async generateEtiqueta(pecaIds) {
        // Placeholder for ZPL/PDF generation
        return { message: 'Etiquetas geradas', ids: pecaIds };
    }

    async deletePeca(id) {
        const peca = await Peca.findByPk(id);
        if (!peca) throw new Error('Peca not found');
        await peca.destroy();
        return { message: 'Peca deleted successfully' };
    }

    async getAllMarcas() {
        return await Marca.findAll({
            order: [['nome', 'ASC']]
        });
    }
}

module.exports = new CatalogoService();
