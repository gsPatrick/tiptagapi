const { Campanha, FilaBot, Pessoa, PerfilComportamental, Peca } = require('../../models');
const { Op } = require('sequelize');

class MarketingService {
    async createCampanha(data) {
        return await Campanha.create(data);
    }

    async getAllCampanhas() {
        return await Campanha.findAll();
    }

    async addProdutosToCampanha(campanhaId, pecaIds) {
        const campanha = await Campanha.findByPk(campanhaId);
        if (!campanha) throw new Error('Campanha não encontrada');

        const desconto = parseFloat(campanha.desconto_percentual);

        const pecas = await Peca.findAll({
            where: { id: pecaIds }
        });

        for (const peca of pecas) {
            const precoVenda = parseFloat(peca.preco_venda);
            const precoPromocional = precoVenda * (1 - desconto / 100);

            await peca.update({
                campanhaId: campanha.id,
                preco_promocional: precoPromocional.toFixed(2)
            });
        }

        return { message: `${pecas.length} produtos adicionados à campanha` };
    }

    async triggerBotMatch(pecaId) {
        const peca = await Peca.findByPk(pecaId, {
            include: ['tamanho', 'marca']
        });
        if (!peca) return;

        // Placeholder logic for bot matching
        // In a real scenario, we would query PerfilComportamental

        return { message: 'Bot triggered (Placeholder)' };
    }
}

module.exports = new MarketingService();
