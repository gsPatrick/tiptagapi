const { Peca, FotoPeca, Pessoa, Tamanho, Cor, Marca, Categoria, MovimentacaoEstoque } = require('../../models');
const { Op } = require('sequelize');

class CatalogoService {
    async createPeca(data, userId) {
        console.log('[CatalogoService] Creating Peca:', data);
        const { fotos, ...pecaData } = data;

        // Auto-generate sequential ID and label code
        const lastPeca = await Peca.findOne({
            order: [['id', 'DESC']], // Assuming id is sequential enough or use a separate counter
        });
        // We can use a simpler approach: Count + 1000 or just use ID after creation if not strict.
        // But prompt wants "TAG-10020".
        // Let's try to get max of a specific field if it exists, or just use ID.
        // We'll use a random or sequential logic.
        // For robustness, let's just use a timestamp based or simple increment if we had a counter.
        // We'll stick to the previous logic of finding last one.

        // Note: This is not race-condition safe without locking, but acceptable for prototype.
        const nextSeq = lastPeca ? (parseInt(lastPeca.codigo_etiqueta.split('-')[1]) || 1000) + 1 : 1001;
        pecaData.codigo_etiqueta = `TAG-${nextSeq}`;

        if (pecaData.tipo_aquisicao === 'CONSIGNACAO' && !pecaData.fornecedorId) {
            throw new Error('Fornecedor é obrigatório para consignação');
        }

        // Idempotency Check: If sku_ecommerce is provided, check if it already exists
        if (pecaData.sku_ecommerce) {
            const existingPeca = await Peca.findOne({ where: { sku_ecommerce: pecaData.sku_ecommerce } });
            if (existingPeca) {
                console.log(`[CatalogoService] Peca with sku_ecommerce ${pecaData.sku_ecommerce} already exists. Returning existing.`);
                // Optionally update it? For now just return to stop duplication loop.
                return this.getPecaById(existingPeca.id);
            }
        }

        const peca = await Peca.create(pecaData);

        // Log Stock Entry
        await MovimentacaoEstoque.create({
            pecaId: peca.id,
            userId: userId || null, // Might be null if not passed
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

        return this.getPecaById(peca.id);
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
                { descricao_curta: { [Op.like]: `%${search}%` } },
                { codigo_etiqueta: { [Op.like]: `%${search}%` } }
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
