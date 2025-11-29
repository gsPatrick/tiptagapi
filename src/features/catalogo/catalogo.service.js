const { Peca, FotoPeca, Pessoa, Tamanho, Cor, Marca, Categoria, MovimentacaoEstoque } = require('../../models');
const { Op } = require('sequelize');

class CatalogoService {
    async createPeca(data, userId) {
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
        return await Peca.findAll({
            where: filters,
            include: [
                { model: FotoPeca, as: 'fotos' },
                { model: Tamanho, as: 'tamanho' },
                { model: Cor, as: 'cor' },
                { model: Marca, as: 'marca' },
                { model: Categoria, as: 'categoria' },
            ],
        });
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
}

module.exports = new CatalogoService();
