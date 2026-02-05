const { MovimentacaoEstoque, Peca } = require('../../models');
const { Op } = require('sequelize');

class EstoqueService {
    async logMovimentacao(data) {
        // data: { pecaId, userId, tipo, quantidade, motivo }
        return await MovimentacaoEstoque.create(data);
    }

    async realizarAuditoria(codigosLidos) {
        // codigosLidos: Array of strings (codigo_etiqueta)

        // 1. Find all pieces currently marked as 'DISPONIVEL' or 'A_VENDA' (using new status DISPONIVEL)
        const pecasSistema = await Peca.findAll({
            where: {
                status: { [Op.in]: ['DISPONIVEL', 'A_VENDA'] } // Supporting both for backward compat if needed, but new is DISPONIVEL
            }
        });

        const mapPecasSistema = new Map(pecasSistema.map(p => [p.codigo_etiqueta, p]));
        const setCodigosLidos = new Set(codigosLidos);

        const resultado = {
            sucesso: [],
            nao_encontradas_no_sistema: [], // Lidas mas não existem ou não deveriam estar lá
            nao_lidas_no_inventario: [], // Estão no sistema mas não foram lidas (Perdidas?)
            divergencias_status: [], // Lidas mas constam como VENDIDA/etc
        };

        // Check Lidas
        for (const codigo of codigosLidos) {
            const peca = await Peca.findOne({ where: { codigo_etiqueta: codigo } });

            if (!peca) {
                resultado.nao_encontradas_no_sistema.push(codigo);
                continue;
            }

            if (['DISPONIVEL', 'A_VENDA'].includes(peca.status)) {
                resultado.sucesso.push(codigo);
                // Mark as audited? Maybe update updated_at or a specific field.
            } else {
                resultado.divergencias_status.push({
                    codigo,
                    status_atual: peca.status,
                    mensagem: 'Peça lida mas consta com status diferente de DISPONIVEL'
                });
            }
        }

        // Check Missing
        for (const [codigo, peca] of mapPecasSistema) {
            if (!setCodigosLidos.has(codigo)) {
                resultado.nao_lidas_no_inventario.push({
                    codigo,
                    descricao: peca.descricao_curta,
                    localId: peca.localId
                });
            }
        }

        return resultado;
    }

    async getHistory(pecaId) {
        return await MovimentacaoEstoque.findAll({
            where: { pecaId },
            order: [['createdAt', 'DESC']],
            include: [{ model: Peca, as: 'peca' }]
        });
    }
}

module.exports = new EstoqueService();
